import { mkdir } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ulid } from 'ulid';
import { StorageService } from './integrations/storage/storage.service';

export const REQUEST_ID_HEADER = 'x-request-id';

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    genReqId: (req: IncomingMessage) => {
      const header = req.headers[REQUEST_ID_HEADER];
      const value = Array.isArray(header) ? header[0] : header;

      return value || ulid();
    },
  });
}

export async function configureApp(app: NestFastifyApplication): Promise<void> {
  app.setGlobalPrefix('api', {
    exclude: [
      '.well-known/apple-app-site-association',
      'apple-app-site-association',
      '.well-known/assetlinks.json',
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  const fastify = app.getHttpAdapter().getInstance();

  fastify.addHook('onRequest', (request, reply, done) => {
    (request.raw as IncomingMessage & { id?: string }).id = String(request.id);
    void reply.header('X-Request-Id', String(request.id));
    done();
  });

  await fastify.register(fastifyMultipart, {
    attachFieldsToBody: true,
    limits: { fileSize: 64 * 1024 * 1024 },
  });

  const storage = app.get(StorageService);
  await mkdir(storage.localRoot, { recursive: true });

  await fastify.register(fastifyStatic, {
    root: storage.localRoot,
    prefix: '/storage/',
    decorateReply: false,
  });
}

export function setupSwagger(app: NestFastifyApplication): void {
  const config = app.get(ConfigService);

  const builder = new DocumentBuilder()
    .setTitle(config.get<string>('APP_NAME') ?? 'cheevo')
    .setDescription(
      'cheevo API — the social events platform. All responses use a consistent envelope: ' +
        '{ status, message, data } on success and { status, message, code, errors } on error.',
    )
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, builder));
}
