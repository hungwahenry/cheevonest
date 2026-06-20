import { Controller, Get, Header, Query, Version } from '@nestjs/common';
import { VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import { Public } from '../../auth/decorators/auth.decorators';
import { SkipEnvelope } from '../../../common/decorators/api-response.decorators';
import { HtmlPagesService } from '../../../common/html/html-pages.service';
import { PaymentsService } from '../services/payments.service';
import { PurposableRegistry } from '../services/purposable-registry.service';

@Public()
@SkipEnvelope()
@Controller('payments')
export class PaymentReturnController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly purposables: PurposableRegistry,
    private readonly pages: HtmlPagesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** HTTPS→app-scheme bridge: providers that require https callbacks land here, we bounce into the app. */
  @Get('return')
  @Version(VERSION_NEUTRAL)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async return(@Query() query: Record<string, string>): Promise<string> {
    const scheme = this.config.get('APP_DEEP_LINK_SCHEME', { infer: true });
    const fallback = `${scheme}:///checkout/return`;

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
      const payment = await this.payments.findByAnyReference(reference);

      if (payment) {
        const params = await this.purposables.returnParams(
          payment.purposableType,
          payment.purposableId,
        );

        for (const [key, value] of Object.entries(params)) {
          forward.set(key, value);
        }
      }
    }

    const queryString = forward.toString();
    const deepLink =
      queryString === ''
        ? target
        : `${target}${target.includes('?') ? '&' : '?'}${queryString}`;

    return this.pages.render('payment-return', {
      deepLink,
      deepLinkJson: JSON.stringify(deepLink),
    });
  }
}
