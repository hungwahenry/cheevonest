import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  UserForResource,
  UsersService,
} from '../../users/services/users.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

export interface VerifiedSession {
  token: string;
  user: UserForResource;
  isNewUser: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  async sendOtp(email: string): Promise<void> {
    await this.otp.send(email);
  }

  /** Verifies the code, resolves the account (sign-up or login), and issues a token. */
  async verifyOtp(email: string, code: string): Promise<VerifiedSession> {
    await this.otp.verify(email, code);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    const isNewUser = existing === null;
    let user = existing ?? (await this.users.createWithProfile(email));

    if (user.emailVerifiedAt === null) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    return {
      token: await this.tokens.issue(user.id),
      user: await this.users.findForResource(user.id),
      isNewUser,
    };
  }
}
