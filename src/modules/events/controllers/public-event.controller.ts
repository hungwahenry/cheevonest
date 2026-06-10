import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { Public } from '../../auth/decorators/auth.decorators';
import { EventSerializer } from '../serializers/event.serializer';

@Public()
@Controller('events')
export class PublicEventController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: EventSerializer,
  ) {}

  @Get(':slug')
  async show(@Param('slug') slug: string): Promise<unknown> {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: { in: ['published', 'past'] } },
      include: {
        organisation: true,
        tickets: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
        features: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
      },
    });

    if (!event) {
      throw new NotFoundException();
    }

    return this.serializer.publicPage(event);
  }
}
