import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { User } from '../../../generated/prisma/client';
import { StorageService } from '../../../integrations/storage/storage.service';
import {
  UserForResource,
  UsersService,
} from '../../users/services/users.service';
import { assertValidAvatar } from '../avatar-rules';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly users: UsersService,
  ) {}

  async update(user: User, dto: UpdateProfileDto): Promise<UserForResource> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { userId: user.id },
    });

    const data: Prisma.ProfileUncheckedUpdateInput = {};

    if (dto.first_name !== undefined) data.firstName = dto.first_name;
    if (dto.last_name !== undefined) data.lastName = dto.last_name;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.place_name !== undefined) data.placeName = dto.place_name;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.city !== undefined) data.city = dto.city;

    if (dto.username !== undefined) {
      await this.users.assertUsernameAvailable(dto.username, user.id);
      data.username = dto.username;
    }

    if (dto.avatar) {
      assertValidAvatar(dto.avatar);

      if (profile.avatarPath !== null) {
        await this.storage.delete(profile.avatarPath);
      }

      data.avatarPath = await this.storage.put(dto.avatar, 'avatars');
    } else if (dto.remove_avatar && profile.avatarPath !== null) {
      await this.storage.delete(profile.avatarPath);
      data.avatarPath = null;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.profile.update({ where: { id: profile.id }, data });
    }

    return this.users.findForResource(user.id);
  }
}
