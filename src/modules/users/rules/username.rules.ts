import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../common/exceptions/api.exception';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UsernameRules {
  constructor(private readonly prisma: PrismaService) {}

  async isAvailable(username: string, ownUserId: string): Promise<boolean> {
    const taken = await this.prisma.profile.findFirst({
      where: { username, NOT: { userId: ownUserId } },
      select: { id: true },
    });

    return taken === null;
  }

  async ensureAvailable(username: string, ownUserId: string): Promise<void> {
    if (!(await this.isAvailable(username, ownUserId))) {
      throw new ValidationFailedException({
        username: ['The username has already been taken.'],
      });
    }
  }
}
