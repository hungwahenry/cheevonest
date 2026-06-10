import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Paginated } from '../../../common/responses/paginated';
import { toNumber } from '../../../common/validation/transforms';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { CommentSerializer } from '../serializers/comment.serializer';

class UserCommentsPageDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
}

@Controller('users/:userId/comments')
export class UserCommentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: CommentSerializer,
  ) {}

  @Get()
  async list(
    @Param('userId') userId: string,
    @Query() dto: UserCommentsPageDto,
  ): Promise<Paginated<unknown>> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { completedAt: true },
    });

    if (!profile || profile.completedAt === null) {
      throw new NotFoundException();
    }

    const page = dto.page ?? 1;
    const perPage = 20;

    const where: Prisma.EventCommentWhereInput = {
      userId,
      flagsCount: 0,
      event: { status: { in: ['published', 'past'] } },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.eventComment.count({ where }),
      this.prisma.eventComment.findMany({
        where,
        include: { event: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return new Paginated(
      rows.map((comment) => this.serializer.userComment(comment)),
      page,
      perPage,
      total,
    );
  }
}
