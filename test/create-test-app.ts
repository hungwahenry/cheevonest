import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp, createFastifyAdapter } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import {
  MailMessage,
  MailService,
} from '../src/integrations/mail/mail.service';
import {
  seedFeatureFlags,
  seedInterests as seedInterestRows,
  seedOrganisationCatalog,
  seedReportReasons,
  seedSystemConfigs,
} from '../prisma/seeders';

export interface TestContext {
  app: NestFastifyApplication;
  prisma: PrismaService;
  mails: MailMessage[];
}

export interface TestAppOptions {
  overrides?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestContext> {
  const mails: MailMessage[] = [];

  let builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useValue({
      send: (message: MailMessage) => {
        mails.push(message);
        return Promise.resolve();
      },
    });

  if (options.overrides) {
    builder = options.overrides(builder);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    createFastifyAdapter(),
    { rawBody: true },
  );

  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, prisma: app.get(PrismaService), mails };
}

export async function seedInterests(prisma: PrismaService): Promise<void> {
  await seedInterestRows(prisma);
}

export async function seedPlatform(prisma: PrismaService): Promise<void> {
  await seedSystemConfigs(prisma);
  await seedFeatureFlags(prisma);
  await seedReportReasons(prisma);
}

export async function seedCatalog(prisma: PrismaService): Promise<void> {
  await seedOrganisationCatalog(prisma);
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
