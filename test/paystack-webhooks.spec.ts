import { describe, expect, it } from 'vitest';
import { PaystackCharges } from '../src/modules/payments/providers/paystack/paystack-charges';
import { PaystackClient } from '../src/modules/payments/providers/paystack/paystack.client';
import { PaystackTransfers } from '../src/modules/payments/providers/paystack/paystack-transfers';

const charges = new PaystackCharges({} as PaystackClient);
const transfers = new PaystackTransfers({} as PaystackClient);

describe('PaystackCharges.parseWebhookEvent', () => {
  it('reads charge.success from the flat transaction payload', () => {
    const event = charges.parseWebhookEvent({
      event: 'charge.success',
      data: { reference: 'paystack_abc', amount: 700000, currency: 'NGN' },
    });

    expect(event).toMatchObject({
      reference: 'paystack_abc',
      status: 'successful',
      amountMinor: 700000,
    });
  });

  it('reads refund.processed from transaction_reference (string amount)', () => {
    const event = charges.parseWebhookEvent({
      event: 'refund.processed',
      data: {
        status: 'processed',
        transaction_reference: 'paystack_abc',
        amount: '10000',
        currency: 'NGN',
      },
    });

    expect(event).toMatchObject({
      reference: 'paystack_abc',
      status: 'refunded',
      amountMinor: 10000,
    });
  });

  it('ignores events Paystack never sends', () => {
    expect(
      charges.parseWebhookEvent({ event: 'charge.failed', data: {} }),
    ).toBeNull();
    expect(
      charges.parseWebhookEvent({ event: 'charge.abandoned', data: {} }),
    ).toBeNull();
  });
});

describe('PaystackTransfers.parseWebhookEvent', () => {
  it('maps the three transfer events and ignores others', () => {
    const status = (event: string) =>
      transfers.parseWebhookEvent({ event, data: { reference: 'po_1' } })
        ?.status;

    expect(status('transfer.success')).toBe('paid');
    expect(status('transfer.failed')).toBe('failed');
    expect(status('transfer.reversed')).toBe('reversed');
    expect(
      transfers.parseWebhookEvent({ event: 'charge.success', data: {} }),
    ).toBeNull();
  });

  it('takes the failure cause from data.failures, not the narration', () => {
    const event = transfers.parseWebhookEvent({
      event: 'transfer.failed',
      data: {
        reference: 'po_1',
        reason: 'cheevo payout 123',
        failures: 'Account resolution failed',
      },
    });

    expect(event?.failureReason).toBe('Account resolution failed');
  });
});

describe('PaystackTransfers.transfer', () => {
  it('fails loudly when Paystack parks the transfer for OTP', async () => {
    const client = {
      post: () => Promise.resolve({ status: 'otp' }),
    } as unknown as PaystackClient;

    await expect(
      new PaystackTransfers(client).transfer({
        amountMinor: 1000,
        currency: 'NGN',
        reference: 'po_1',
        reason: 'x',
        recipientCode: 'RCP',
        bankCode: '058',
        accountNumber: '0000000000',
        accountName: 'X',
      }),
    ).rejects.toThrow(/OTP/);
  });
});
