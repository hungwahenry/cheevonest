import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { Env } from '../../config/env';

export interface RenderedMail {
  html: string;
  text?: string;
}

@Injectable()
export class MailTemplatesService {
  private readonly handlebars = Handlebars.create();
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();
  private readonly defaults: Record<string, unknown>;

  constructor(config: ConfigService<Env, true>) {
    this.defaults = { webUrl: config.get('WEB_URL', { infer: true }) };
    this.loadTemplates(join(__dirname, 'templates'));
  }

  render(name: string, context: Record<string, unknown> = {}): RenderedMail {
    const merged = {
      ...this.defaults,
      year: new Date().getFullYear(),
      ...context,
    };

    return {
      html: this.compiled(name)(merged),
      text: this.templates.has(`${name}.text`)
        ? this.compiled(`${name}.text`)(merged).trim()
        : undefined,
    };
  }

  private compiled(name: string): Handlebars.TemplateDelegate {
    const template = this.templates.get(name);

    if (!template) {
      throw new Error(`Unknown mail template "${name}".`);
    }

    return template;
  }

  private loadTemplates(dir: string): void {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.hbs')) {
        continue;
      }

      const name = basename(file, '.hbs');
      const source = readFileSync(join(dir, file), 'utf8');

      if (name === 'layout') {
        this.handlebars.registerPartial(name, source);
        continue;
      }

      this.templates.set(name, this.handlebars.compile(source));
    }
  }
}
