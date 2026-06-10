import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class WebhookIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** True if this is the first time we see the event; false on replays. */
  async recordIfNew(
    provider: string,
    eventType: string,
    externalId: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    if (eventType === '' || externalId === '') {
      return true;
    }

    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider,
          eventType,
          externalId,
          receivedAt: new Date(),
          payload: payload as Prisma.InputJsonValue,
        },
      });

      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }

      throw error;
    }
  }
}
