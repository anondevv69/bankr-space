import { X402_EXACT_PERMIT2_PROXY_ADDRESS } from '@/lib/x402-bankr-permit2-sign';
import { decodeX402PaymentDiagnostics } from '@/lib/x402-facilitator-verify';

export type BankrFacilitatorVerifyResult = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
  error?: string;
};

export type BankrFacilitatorSettleResult = {
  success: boolean;
  transaction?: string;
  errorReason?: string;
  payer?: string;
  error?: string;
};

export function parseX402PaymentPayload(xPayment: string): unknown | null {
  try {
    return JSON.parse(Buffer.from(xPayment, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function parsePaymentRequirements(paymentRequiredHeader: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(paymentRequiredHeader, 'base64').toString('utf8')) as Record<
    string,
    unknown
  >;
}

/** Bankr upstream quotes payTo as permit2Spender; proxy-signed payloads fail that pre-check. */
export function isRecoverableBankrPermit2SpenderMismatch(
  xPayment: string,
  reason?: string | null
): boolean {
  if (reason !== 'permit2_spender_mismatch') return false;
  const payment = decodeX402PaymentDiagnostics(xPayment);
  return (
    payment?.permit2Spender?.toLowerCase() === X402_EXACT_PERMIT2_PROXY_ADDRESS.toLowerCase()
  );
}

export async function verifyBankrFacilitatorPayment(
  paymentPayload: unknown,
  paymentRequiredHeader: string
): Promise<BankrFacilitatorVerifyResult> {
  try {
    const res = await fetch('https://api.bankr.bot/facilitator/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements: parsePaymentRequirements(paymentRequiredHeader),
      }),
      cache: 'no-store',
    });
    const data = (await res.json()) as {
      isValid?: boolean;
      invalidReason?: string;
      payer?: string;
      error?: string;
    };
    return {
      isValid: data.isValid === true,
      invalidReason: data.invalidReason,
      payer: data.payer,
      error: data.error,
    };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Facilitator verify failed',
    };
  }
}

export async function settleBankrFacilitatorPayment(
  paymentPayload: unknown,
  paymentRequiredHeader: string
): Promise<BankrFacilitatorSettleResult> {
  try {
    const res = await fetch('https://api.bankr.bot/facilitator/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements: parsePaymentRequirements(paymentRequiredHeader),
      }),
      cache: 'no-store',
    });
    const data = (await res.json()) as {
      success?: boolean;
      transaction?: string;
      errorReason?: string;
      invalidReason?: string;
      payer?: string;
      error?: string;
    };
    return {
      success: data.success === true,
      transaction: typeof data.transaction === 'string' ? data.transaction : undefined,
      errorReason: data.errorReason || data.invalidReason,
      payer: data.payer,
      error: data.error,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Facilitator settle failed',
    };
  }
}
