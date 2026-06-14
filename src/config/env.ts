import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_NAME: z.string().default('cheevo'),
  APP_KEY: z.string().min(16).default('dev-app-key-not-for-production'),
  APP_URL: z.string().default('http://127.0.0.1:3000'),
  WEB_URL: z.string().default('https://cheevo.events'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  STORAGE_DISK: z.enum(['local', 's3']).default('local'),
  STORAGE_DIR: z.string().default('storage/public'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .preprocess((value) => value === 'true' || value === '1', z.boolean())
    .default(true),

  MAIL_DRIVER: z.enum(['log', 'resend']).default('log'),
  MAIL_FROM_ADDRESS: z.string().default('no-reply@cheevo.vip'),
  MAIL_FROM_NAME: z.string().default('cheevo'),
  RESEND_API_KEY: z.string().optional(),

  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(60),
  OTP_REVIEW_EMAILS: z.string().default(''),
  OTP_REVIEW_CODE: z.string().optional(),

  AUTH_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(43200),

  ADMIN_BOOTSTRAP_EMAIL: z.string().optional(),

  DICEBEAR_URL: z.string().default('https://api.dicebear.com/9.x'),
  DICEBEAR_STYLE: z.string().default('thumbs'),
  DICEBEAR_FORMAT: z.string().default('png'),

  PAYMENTS_DEFAULT_PROVIDER: z
    .enum(['paystack', 'flutterwave'])
    .default('paystack'),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_BASE_URL: z.string().default('https://api.paystack.co'),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_HASH: z.string().optional(),
  FLUTTERWAVE_BASE_URL: z.string().default('https://api.flutterwave.com/v3'),
  PAYMENT_BRIDGE_URL: z.string().optional(),
  APP_DEEP_LINK_SCHEME: z.string().default('cheevo'),

  BROADCASTS_FROM_ADDRESS: z.string().default('events@cheevo.vip'),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  GIPHY_API_KEY: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),

  SYSTEM_CONFIG_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(60),

  APPLE_TEAM_ID: z.string().optional(),
  IOS_BUNDLE_ID: z.string().default('events.cheevo.app'),
  ANDROID_PACKAGE_NAME: z.string().default('events.cheevo.app'),
  ANDROID_SHA256_FINGERPRINTS: z.string().default(''),
});

const refinedEnvSchema = envSchema.superRefine((env, ctx) => {
  if (
    env.STORAGE_DISK === 's3' &&
    (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['STORAGE_DISK'],
      message:
        'STORAGE_DISK=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY',
    });
  }

  if (env.MAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['MAIL_DRIVER'],
      message: 'MAIL_DRIVER=resend requires RESEND_API_KEY',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = refinedEnvSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
