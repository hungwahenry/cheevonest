import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp, createFastifyAdapter } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import {
  MailMessage,
  MailService,
} from '../src/integrations/mail/mail.service';
import { INTERESTS } from '../prisma/seed-data';

export interface TestContext {
  app: NestFastifyApplication;
  prisma: PrismaService;
  mails: MailMessage[];
}

export async function createTestApp(): Promise<TestContext> {
  const mails: MailMessage[] = [];

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useValue({
      send: (message: MailMessage) => {
        mails.push(message);
        return Promise.resolve();
      },
    })
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    createFastifyAdapter(),
  );

  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, prisma: app.get(PrismaService), mails };
}

export async function seedInterests(prisma: PrismaService): Promise<void> {
  for (const [index, interest] of INTERESTS.entries()) {
    await prisma.interest.upsert({
      where: { slug: interest.slug },
      update: {},
      create: {
        slug: interest.slug,
        name: interest.name,
        sortOrder: index,
        isActive: true,
      },
    });
  }
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export function extractOtpCode(mail: MailMessage): string {
  const code = (mail.context?.code as string) ?? '';

  if (!/^\d+$/.test(code)) {
    throw new Error('No OTP code found in captured mail.');
  }

  return code;
}
