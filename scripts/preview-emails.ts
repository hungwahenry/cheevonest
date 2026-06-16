import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import Handlebars from 'handlebars';

const templatesDir = join(__dirname, '..', 'src', 'integrations', 'mail', 'templates');
const outDir = join(tmpdir(), 'cheevo-email-previews');

const defaults = {
  webUrl: 'https://cheevo.events',
  appName: 'cheevo',
  year: new Date().getFullYear(),
};

const samples: Record<string, Record<string, unknown>> = {
  'otp-code': { code: '481923', ttlMinutes: 10 },
  'change-email-current-otp': { newEmail: 'amara@example.com', code: '481923', ttlMinutes: 10 },
  'change-email-new-otp': { code: '481923', ttlMinutes: 10 },
  'delete-account-otp': { code: '481923', ttlMinutes: 10 },
  'order-paid': { eventTitle: 'Lagos Rooftop Sundown', eventSlug: 'lagos-rooftop-sundown', tickets: 2 },
  'first-sale': { eventTitle: 'Lagos Rooftop Sundown' },
  'new-event-from-subscription': {
    organisationName: 'Sunset Collective',
    eventTitle: 'Lagos Rooftop Sundown',
    eventSlug: 'lagos-rooftop-sundown',
  },
  'event-starting-soon-attendee': { eventTitle: 'Lagos Rooftop Sundown', eventSlug: 'lagos-rooftop-sundown' },
  'event-starting-soon-organizer': { eventTitle: 'Lagos Rooftop Sundown' },
  'daily-sales-digest': { eventTitle: 'Lagos Rooftop Sundown', revenue: '420,000', tickets: 84, orders: 61 },
  'comment-reply': {
    eventTitle: 'Lagos Rooftop Sundown',
    eventSlug: 'lagos-rooftop-sundown',
    preview: 'Are early-bird tickets still available for this one?',
  },
  'comment-flagged': { preview: 'This is spam, please remove it from the thread.' },
  'payout-completed': { bankName: 'GTBank', accountNumber: '0123456789' },
  'payout-failed': { reason: 'The provided account number could not be verified.' },
  broadcast: {
    organisationName: 'Sunset Collective',
    eventTitle: 'Lagos Rooftop Sundown',
    bodyHtml:
      '<p>Doors open at 8pm sharp this Saturday. Come early to beat the queue.</p><p>Bring a valid ID and your QR code &mdash; that&rsquo;s all you need at the gate.</p>',
    unsubscribeUrl: 'https://cheevo.events/u/unsubscribe?token=demo',
  },
  'system-announcement': {
    title: 'Scheduled maintenance this Sunday',
    bodyHtml:
      '<p>We&rsquo;ll be doing a quick upgrade on Sunday between 2&ndash;3am WAT. The app may be briefly unavailable.</p><p>Thanks for being part of cheevo.</p>',
    unsubscribeUrl: 'https://cheevo.events/u/unsubscribe?token=demo',
  },
};

const handlebars = Handlebars.create();
handlebars.registerHelper('concat', (...args: unknown[]) => args.slice(0, -1).join(''));

for (const file of readdirSync(join(templatesDir, 'partials'))) {
  if (!file.endsWith('.hbs')) continue;
  handlebars.registerPartial(basename(file, '.hbs'), readFileSync(join(templatesDir, 'partials', file), 'utf8'));
}
handlebars.registerPartial('layout', readFileSync(join(templatesDir, 'layout.hbs'), 'utf8'));

mkdirSync(outDir, { recursive: true });
const rendered: string[] = [];

for (const file of readdirSync(templatesDir)) {
  if (!file.endsWith('.hbs')) continue;
  const name = basename(file, '.hbs');
  if (name === 'layout' || name.endsWith('.text')) continue;

  const template = handlebars.compile(readFileSync(join(templatesDir, file), 'utf8'));
  const html = template({ ...defaults, ...(samples[name] ?? {}) });
  writeFileSync(join(outDir, `${name}.html`), html);
  rendered.push(name);
}

const index = `<!DOCTYPE html><meta charset="utf-8"><title>cheevo email previews</title>
<body style="margin:0;background:#f8f6f1;font-family:-apple-system,system-ui,sans-serif;">
<h1 style="padding:24px 28px 0;font-size:18px;">cheevo email previews</h1>
${rendered
  .sort()
  .map(
    (name) =>
      `<details open style="margin:16px 28px;background:#fff;border:1px solid #eceae3;border-radius:12px;overflow:hidden;"><summary style="padding:12px 16px;font-weight:600;cursor:pointer;">${name}</summary><iframe src="./${name}.html" style="width:100%;height:640px;border:0;border-top:1px solid #eceae3;"></iframe></details>`,
  )
  .join('\n')}
</body>`;
writeFileSync(join(outDir, 'index.html'), index);

console.log(`Rendered ${rendered.length} templates to:`);
console.log(`  ${join(outDir, 'index.html')}`);
