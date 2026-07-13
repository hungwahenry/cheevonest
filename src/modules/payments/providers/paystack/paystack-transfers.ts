import { Injectable } from '@nestjs/common';
import {
  CreateTransferRecipientRequest,
  InitiatedTransfer,
  InitiateTransferRequest,
  TransferWebhookEvent,
} from '../../contracts/payment-provider.interface';
import { PaymentProviderException } from '../../exceptions/payment-provider.exception';
import { str } from '../../support/json';
import { PaystackClient } from './paystack.client';

@Injectable()
export class PaystackTransfers {
  constructor(private readonly client: PaystackClient) {}

  async createTransferRecipient(
    request: CreateTransferRecipientRequest,
  ): Promise<string | null> {
    const data = await this.client.post('/transferrecipient', {
      type: 'nuban',
      name: request.name,
      account_number: request.accountNumber,
      bank_code: request.bankCode,
      currency: request.currency,
    });

    const code = str(data.recipient_code);

    return code !== '' ? code : null;
  }

  async transfer(request: InitiateTransferRequest): Promise<InitiatedTransfer> {
    if (request.recipientCode === null) {
      throw new PaymentProviderException(
        'paystack',
        'transfer: recipient_code is required',
      );
    }

    const data = await this.client.post('/transfer', {
      source: 'balance',
      amount: request.amountMinor,
      currency: request.currency,
      recipient: request.recipientCode,
      reference: request.reference,
      reason: request.reason,
    });

    return {
      providerReference: str(
        data.transfer_code,
        str(data.reference, request.reference),
      ),
      status: 'processing',
      providerResponse: data,
    };
  }

  parseWebhookEvent(
    payload: Record<string, unknown>,
  ): TransferWebhookEvent | null {
    const event = str(payload.event ?? '');

    if (
      !['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(
        event,
      )
    ) {
      return null;
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;
    const status =
      event === 'transfer.success'
        ? 'paid'
        : event === 'transfer.reversed'
          ? 'reversed'
          : 'failed';

    return {
      reference: str(data.reference ?? ''),
      providerReference: data.transfer_code ? str(data.transfer_code) : null,
      status,
      failureReason:
        status === 'paid'
          ? null
          : str(data.reason ?? data.failure_reason ?? '') || null,
      providerResponse: data,
    };
  }

  async verify(reference: string): Promise<TransferWebhookEvent | null> {
    const data = await this.client.get(
      `/transfer/verify/${encodeURIComponent(reference)}`,
    );
    const status = this.mapStatus(str(data.status ?? ''));

    if (status === null) {
      return null;
    }

    return {
      reference: str(data.reference, reference),
      providerReference: data.transfer_code ? str(data.transfer_code) : null,
      status,
      failureReason:
        status === 'paid'
          ? null
          : str(data.reason ?? data.failures ?? '') || null,
      providerResponse: data,
    };
  }

  private mapStatus(raw: string): 'paid' | 'failed' | 'reversed' | null {
    switch (raw) {
      case 'success':
        return 'paid';
      case 'failed':
      case 'abandoned':
        return 'failed';
      case 'reversed':
        return 'reversed';
      default:
        return null;
    }
  }
}
