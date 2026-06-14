import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { WelcomeContent } from '../../../generated/prisma/client';

const DEFAULT_HEADLINE = 'Find your people, find your night.';
const DEFAULT_SUBHEADLINE =
  "Discover parties, concerts and events near you — and see who's going.";

@Injectable()
export class WelcomeService {
  constructor(private readonly prisma: PrismaService) {}

  async content(): Promise<WelcomeContent> {
    return (
      (await this.prisma.welcomeContent.findFirst({
        orderBy: { id: 'asc' },
      })) ??
      (await this.prisma.welcomeContent.create({
        data: { headline: DEFAULT_HEADLINE, subheadline: DEFAULT_SUBHEADLINE },
      }))
    );
  }

  async update(data: {
    headline?: string;
    subheadline?: string;
    backgroundPath?: string | null;
  }): Promise<WelcomeContent> {
    const current = await this.content();

    return this.prisma.welcomeContent.update({
      where: { id: current.id },
      data,
    });
  }
}
