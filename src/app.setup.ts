import type { IncomingMessage } from 'node:http';
import { VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ulid } from 'ulid';

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

export function configureApp(app: NestFastifyApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      (request.raw as IncomingMessage & { id?: string }).id = String(
        request.id,
      );
      void reply.header('X-Request-Id', String(request.id));
      done();
    });
}

export function setupSwagger(app: NestFastifyApplication): void {
  const config = new DocumentBuilder()
    .setTitle('cheevo API')
    .setDescription(
      'cheevo API — the social events platform. All responses use a consistent envelope: ' +
        '{ status, message, data } on success and { status, message, code, errors } on error.',
    )
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
