import { Controller, Get, Header, Query, Version } from '@nestjs/common';
import { VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';
import { Public } from '../../auth/decorators/auth.decorators';
import { SkipEnvelope } from '../../../common/decorators/api-response.decorators';

@Public()
@SkipEnvelope()
@Controller('payments')
export class PaymentReturnController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** HTTPS→app-scheme bridge: providers that require https callbacks land here, we bounce into the app. */
  @Get('return')
  @Version(VERSION_NEUTRAL)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async return(@Query() query: Record<string, string>): Promise<string> {
    const scheme = this.config.get('APP_DEEP_LINK_SCHEME', { infer: true });
    const fallback = `${scheme}:///orders/return`;

    let target = query.return ?? fallback;

    if (!target.toLowerCase().startsWith(`${scheme}:`)) {
      target = fallback;
    }

    const forward = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (key !== 'return') {
        forward.set(key, value);
      }
    }

    const reference = query.reference ?? query.tx_ref ?? query.trxref ?? '';

    if (reference !== '') {
      const payment = await this.prisma.payment.findFirst({
        where: {
          OR: [{ reference }, { providerReference: reference }],
        },
      });

      if (payment?.purposableType === 'order' && payment.purposableId) {
        forward.set('order_id', payment.purposableId);
      }
    }

    const queryString = forward.toString();
    const deepLink =
      queryString === ''
        ? target
        : `${target}${target.includes('?') ? '&' : '?'}${queryString}`;

    return this.page(deepLink);
  }

  private page(deepLink: string): string {
    const safe = deepLink
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${safe}">
<title>Returning to Cheevo…</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#fff;color:#111}main{text-align:center;padding:24px}a{color:#111;font-weight:600}</style>
</head>
<body>
<main>
<p>Taking you back to the app…</p>
<p><a href="${safe}">Tap here if nothing happens</a></p>
</main>
<script>window.location.replace(${JSON.stringify(deepLink)});</script>
</body>
</html>`;
  }
}
