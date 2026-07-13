import 'dotenv/config';
import { ulid } from 'ulid';
import { PaystackClient } from '../src/modules/payments/providers/paystack/paystack.client';
import { PaystackTransfers } from '../src/modules/payments/providers/paystack/paystack-transfers';
import { BankResolverService } from '../src/modules/payouts/services/bank-resolver.service';

const ACCOUNT_NUMBER = '9071451032';
const BANK_MATCH = 'moniepoint';
const AMOUNT_MINOR = 10000; // ₦100 — test mode moves no real money.

const env: Record<string, unknown> = {
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  PAYSTACK_BASE_URL: process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co',
};
const config = { get: (key: string) => env[key] } as never;

async function main(): Promise<void> {
  const key = String(env.PAYSTACK_SECRET_KEY ?? '');
  const live = key.startsWith('sk_live_');
  if (!key.startsWith('sk_test_') && !live) {
    console.error('Refusing: PAYSTACK_SECRET_KEY is not a valid sk_test_/sk_live_ key.');
    process.exit(1);
  }
  if (live && process.env.CONFIRM_LIVE !== '1') {
    console.error(
      `Refusing: LIVE key detected — this moves REAL money (₦${AMOUNT_MINOR / 100}). Re-run with CONFIRM_LIVE=1.`,
    );
    process.exit(1);
  }
  console.log(`Mode: ${live ? 'LIVE — REAL MONEY' : 'TEST — no real money'}`);

  const client = new PaystackClient(config);
  const transfers = new PaystackTransfers(client);
  const resolver = new BankResolverService(config);

  console.log('1) Listing banks...');
  const banks = await resolver.banks();
  const bank = banks.find((b) => b.name.toLowerCase().includes(BANK_MATCH));
  if (!bank) {
    throw new Error(`No bank matching "${BANK_MATCH}" in the Paystack list.`);
  }
  console.log(`   ${bank.name} -> ${bank.code}`);

  console.log('2) Resolving account...');
  const resolved = await resolver.resolve(ACCOUNT_NUMBER, bank.code);
  console.log(`   ${resolved.account_number} -> ${resolved.account_name}`);

  console.log('3) Creating transfer recipient...');
  const recipientCode = await transfers.createTransferRecipient({
    name: resolved.account_name,
    accountNumber: resolved.account_number,
    bankCode: bank.code,
    currency: 'NGN',
  });
  console.log(`   recipient_code -> ${recipientCode}`);

  const reference = `po_test_${ulid().toLowerCase()}`;
  console.log(`4) Initiating transfer of ₦${AMOUNT_MINOR / 100} (ref ${reference})...`);
  const initiated = await transfers.transfer({
    amountMinor: AMOUNT_MINOR,
    currency: 'NGN',
    reference,
    reason: 'cheevo payout live test',
    recipientCode,
    bankCode: bank.code,
    accountNumber: resolved.account_number,
    accountName: resolved.account_name,
  });
  console.log(`   accepted -> ${JSON.stringify(initiated.providerResponse)}`);

  console.log('5) Verifying transfer...');
  const verified = await transfers.verify(reference);
  console.log(`   status -> ${verified ? verified.status : 'pending (settles via webhook)'}`);

  console.log(
    `\n✅ Full payout path works against Paystack ${live ? 'LIVE' : 'test'} mode (transfers enabled, OTP off).`,
  );
}

main().catch((error) => {
  console.error(`\n❌ FAILED: ${error?.message ?? error}`);
  process.exit(1);
});
