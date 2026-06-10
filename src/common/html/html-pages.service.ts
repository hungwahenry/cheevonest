import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';

/** Renders the handful of browser-facing bridge pages (templates in pages/). */
@Injectable()
export class HtmlPagesService {
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();

  constructor() {
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

    return template(context);
  }
}
