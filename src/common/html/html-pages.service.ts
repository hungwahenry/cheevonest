import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { Env } from '../../config/env';

/** Renders the handful of browser-facing bridge pages (templates in pages/). */
@Injectable()
export class HtmlPagesService {
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();

  private readonly appName: string;

  constructor(config: ConfigService<Env, true>) {
    this.appName = config.get('APP_NAME', { infer: true });

    const dir = join(__dirname, 'pages');

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.hbs')) {
        continue;
      }

      this.templates.set(
        basename(file, '.hbs'),
        Handlebars.compile(readFileSync(join(dir, file), 'utf8')),
      );
    }
  }

  render(name: string, context: Record<string, unknown> = {}): string {
    const template = this.templates.get(name);

    if (!template) {
      throw new Error(`Unknown HTML page template "${name}".`);
    }

    return template({ appName: this.appName, ...context });
  }
}
