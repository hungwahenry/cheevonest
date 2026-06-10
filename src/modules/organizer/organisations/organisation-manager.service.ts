import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { ValidationFailedException } from '../../../common/exceptions/api.exception';
import { UploadedFile } from '../../../common/http/uploaded-file';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { Organisation, User } from '../../../generated/prisma/client';
import { StorageService } from '../../../integrations/storage/storage.service';
import {
  OrganisationForResource,
  OrganisationsService,
} from '../../organisations/organisations.service';
import {
  CreateOrganisationDto,
  SocialEntryDto,
} from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { assertValidImage } from './image-rules';

const LOGO_MAX_KB = 4096;
const COVER_MAX_KB = 8192;

@Injectable()
export class OrganisationManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly organisations: OrganisationsService,
  ) {}

  /** One atomic submission: details, logo/cover, socials. The creator becomes Owner. */
  async create(
    user: User,
    dto: CreateOrganisationDto,
  ): Promise<OrganisationForResource> {
    await this.assertSlugAvailable(dto.slug);
    await this.assertCategoryActive(dto.category_id);
    await this.assertSocialsValid(dto.socials ?? []);

    const logoPath = await this.storeImage(
      dto.logo,
      'logo',
      'logos',
      LOGO_MAX_KB,
    );
    const coverPath = await this.storeImage(
      dto.cover,
      'cover',
      'covers',
      COVER_MAX_KB,
    );

    const organisationId = ulid();

    await this.prisma.$transaction(async (tx) => {
      await tx.organisation.create({
        data: {
          id: organisationId,
          name: dto.name,
          slug: dto.slug,
          categoryId: dto.category_id,
          about: dto.about ?? null,
          contactEmail: dto.contact_email ?? null,
          contactPhone: dto.contact_phone ?? null,
          website: dto.website ?? null,
          city: dto.city ?? null,
          ...(logoPath !== null ? { logoPath } : {}),
          ...(coverPath !== null ? { coverPath } : {}),
        },
      });

      await tx.organisationMember.create({
        data: { organisationId, userId: user.id, role: 'owner' },
      });

      await this.syncSocials(tx, organisationId, dto.socials ?? []);
    });

    return this.organisations.loadForResource(organisationId);
  }

  async update(
    organisation: Organisation,
    dto: UpdateOrganisationDto,
  ): Promise<OrganisationForResource> {
    if (dto.slug !== undefined && dto.slug !== organisation.slug) {
      await this.assertSlugAvailable(dto.slug);
    }

    if (dto.category_id !== undefined) {
      await this.assertCategoryActive(dto.category_id);
    }

    if (dto.socials != null) {
      await this.assertSocialsValid(dto.socials);
    }

    const data: Prisma.OrganisationUncheckedUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.category_id !== undefined) data.categoryId = dto.category_id;
    if (dto.about !== undefined) data.about = dto.about;
    if (dto.contact_email !== undefined) data.contactEmail = dto.contact_email;
    if (dto.contact_phone !== undefined) data.contactPhone = dto.contact_phone;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.city !== undefined) data.city = dto.city;

    if (dto.logo) {
      if (organisation.logoPath !== null) {
        await this.storage.delete(organisation.logoPath);
      }
      data.logoPath = await this.storeImage(
        dto.logo,
        'logo',
        'logos',
        LOGO_MAX_KB,
      );
    }

    if (dto.cover) {
      if (organisation.coverPath !== null) {
        await this.storage.delete(organisation.coverPath);
      }
      data.coverPath = await this.storeImage(
        dto.cover,
        'cover',
        'covers',
        COVER_MAX_KB,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.organisation.update({ where: { id: organisation.id }, data });
      }

      if (dto.socials !== undefined) {
        await this.syncSocials(tx, organisation.id, dto.socials ?? []);
      }
    });

    return this.organisations.loadForResource(organisation.id);
  }

  async isSlugAvailable(slug: string): Promise<boolean> {
    const existing = await this.prisma.organisation.findUnique({
      where: { slug },
      select: { id: true },
    });

    return existing === null;
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    if (!(await this.isSlugAvailable(slug))) {
      throw new ValidationFailedException({
        slug: ['The slug has already been taken.'],
      });
    }
  }

  private async assertCategoryActive(categoryId: number): Promise<void> {
    const category = await this.prisma.organisationCategory.findFirst({
      where: { id: categoryId, isActive: true },
      select: { id: true },
    });

    if (!category) {
      throw new ValidationFailedException({
        category_id: ['The selected category id is invalid.'],
      });
    }
  }

  private async assertSocialsValid(socials: SocialEntryDto[]): Promise<void> {
    if (socials.length === 0) {
      return;
    }

    const ids = [...new Set(socials.map((social) => social.platform_id))];
    const found = await this.prisma.socialPlatform.count({
      where: { id: { in: ids }, isActive: true },
    });

    if (found !== ids.length) {
      throw new ValidationFailedException({
        socials: ['The selected socials are invalid.'],
      });
    }
  }

  private async syncSocials(
    tx: Prisma.TransactionClient,
    organisationId: string,
    socials: SocialEntryDto[],
  ): Promise<void> {
    const byPlatform = new Map(
      socials.map((social) => [social.platform_id, social.handle]),
    );

    await tx.organisationSocial.deleteMany({ where: { organisationId } });

    if (byPlatform.size > 0) {
      await tx.organisationSocial.createMany({
        data: [...byPlatform.entries()].map(([socialPlatformId, handle]) => ({
          organisationId,
          socialPlatformId,
          handle,
        })),
      });
    }
  }

  private async storeImage(
    file: UploadedFile | undefined,
    field: string,
    dir: string,
    maxKb: number,
  ): Promise<string | null> {
    if (!file) {
      return null;
    }

    assertValidImage(file, field, maxKb);

    return this.storage.put(file, dir);
  }
}
