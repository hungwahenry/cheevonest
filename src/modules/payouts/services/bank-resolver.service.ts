import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import { str } from '../../payments/support/json';
import { BankAccountResolveFailedException } from '../exceptions/bank-account-resolve-failed.exception';

const BANKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface Bank {
  code: string;
  name: string;
  slug: string;
}

export interface ResolvedBankAccount {
  account_number: string;
  account_name: string;
  bank_code: string;
}

@Injectable()
export class BankResolverService {
  private banksCache: { fetchedAt: number; banks: Bank[] } | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async banks(country = 'nigeria'): Promise<Bank[]> {
    if (
      this.banksCache &&
      Date.now() - this.banksCache.fetchedAt < BANKS_CACHE_TTL_MS
    ) {
      return this.banksCache.banks;
    }

    const params = new URLSearchParams({ country, perPage: '200' });
    const payload = await this.get(`/bank?${params.toString()}`);

    if (payload === null) {
      return [];
    }

    const parsed = (Array.isArray(payload) ? payload : []).flatMap((bank) =>
      typeof bank === 'object' && bank !== null
        ? [
            {
              code: str((bank as Record<string, unknown>).code),
              name: str((bank as Record<string, unknown>).name),
              slug: str((bank as Record<string, unknown>).slug),
            },
          ]
        : [],
    );

    const seen = new Set<string>();
    const banks = parsed.filter((bank) => {
      if (bank.code === '' || seen.has(bank.code)) {
        return false;
      }
      seen.add(bank.code);
      return true;
    });

    this.banksCache = { fetchedAt: Date.now(), banks };

    return banks;
  }

  async resolve(
    accountNumber: string,
    bankCode: string,
  ): Promise<ResolvedBankAccount> {
    const params = new URLSearchParams({
      account_number: accountNumber,
      bank_code: bankCode,
    });

    const payload = await this.get(`/bank/resolve?${params.toString()}`, true);

    if (payload === null || Array.isArray(payload)) {
      throw new BankAccountResolveFailedException('');
    }

    return {
      account_number: str(payload.account_number, accountNumber),
      account_name: str(payload.account_name),
      bank_code: bankCode,
    };
  }

  async bankName(bankCode: string): Promise<string> {
    const banks = await this.banks();

    return banks.find((bank) => bank.code === bankCode)?.name ?? '';
  }

  private async get(
    path: string,
    throwOnFailure = false,
  ): Promise<Record<string, unknown> | unknown[] | null> {
    const key = this.config.get('PAYSTACK_SECRET_KEY', { infer: true });

    if (!key) {
      if (throwOnFailure) {
        throw new BankAccountResolveFailedException('');
      }

      return null;
    }

    const baseUrl = this.config.get('PAYSTACK_BASE_URL', { infer: true });
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: Record<string, unknown> | unknown[];
    };

    if (!response.ok || payload.status !== true) {
      if (throwOnFailure) {
        throw new BankAccountResolveFailedException(str(payload.message));
      }

      return null;
    }

    return payload.data ?? null;
  }
}
