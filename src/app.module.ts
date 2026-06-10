import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiEnvelopeInterceptor } from './common/interceptors/api-envelope.interceptor';
import { validationExceptionFactory } from './common/validation/validation-exception.factory';
import { Env, validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { PlatformModule } from './modules/platform/platform.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          redact: ['req.headers.authorization'],
        },
      }),
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: seconds(60), limit: 60 }] }),
    DatabaseModule,
    PlatformModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          transform: true,
          exceptionFactory: validationExceptionFactory,
        }),
    },
    { provide: APP_INTERCEPTOR, useClass: ApiEnvelopeInterceptor },
    {
      provide: APP_FILTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new ApiExceptionFilter(
          config.get('NODE_ENV', { infer: true }) !== 'production',
        ),
    },
  ],
})
export class AppModule {}
