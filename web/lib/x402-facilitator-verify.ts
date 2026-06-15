/** Decode Bankr/x402 facilitator invalidReason into a user-facing message. */
export function formatFacilitatorInvalidReason(reason: string): string {
  switch (reason) {
    case 'permit2_deadline_expired':
      return 'Payment authorization expired — click Contribute again and approve in your wallet within 60 seconds.';
    case 'permit2_nonce_used':
    case 'payment_already_used':
      return 'This payment signature was already submitted. Click Contribute again to sign a fresh payment.';
    case 'insufficient_balance':
      return 'Insufficient $Space in your wallet — buy $Space on Base, then try Contribute again.';
    case 'insufficient_allowance':
    case 'permit2_allowance_required':
      return 'Permit2 is not approved for $Space — click Contribute and confirm the first MetaMask transaction (approve), then sign the payment.';
    case 'invalid_permit2_recipient_mismatch':
      return 'Payment destination mismatch — refresh the page and try Contribute again.';
    case 'invalid_permit2_spender':
      return 'Payment signature rejected — hard refresh the page and try Contribute again.';
    case 'permit2_spender_mismatch':
      return 'Payment signature rejected — hard refresh the page and try Contribute again.';
    case 'invalid_permit2_signature':
      return 'Payment signature rejected — hard refresh the page and try Contribute again.';
    case 'witness_to_mismatch':
      return 'Payment destination mismatch — hard refresh the page and try Contribute again.';
    case 'permit2_nonce_used':
      return 'This payment signature was already submitted. Click Contribute again to sign a fresh payment.';
    default:
      return reason.replace(/_/g, ' ');
  }
}

export type X402PaymentDiagnostics = {
  payer?: string;
  deadline?: string;
  deadlineIso?: string;
  secondsRemaining?: number;
  expired?: boolean;
  maxTokens?: number;
  resourceUrl?: string;
  permit2Spender?: string;
};

export type X402FacilitatorVerification = {
  message: string;
  invalidReason?: string;
  payer?: string;
  payment?: X402PaymentDiagnostics;
};

const X402_EXACT_PERMIT2_PROXY_ADDRESS = '0x402085c248EeA27D92E8b30b2C58ed07f9E20001';

/** Bankr x402 Cloud uses a fee-router Permit2 spender — api.bankr.bot/facilitator/verify does not. */
export function isBankrFeeRouterPermit2Quote(paymentRequiredHeader?: string | null): boolean {
  if (!paymentRequiredHeader) return false;
  try {
    const req = JSON.parse(
      Buffer.from(paymentRequiredHeader, 'base64').toString('utf8')
    ) as { accepts?: Array<{ payTo?: string; extra?: { permit2Spender?: string } }> };
    const accept = req.accepts?.[0];
    if (!accept) return false;
    const spender = String(accept.extra?.permit2Spender || accept.payTo || '').toLowerCase();
    return (
      spender.length > 0 && spender !== X402_EXACT_PERMIT2_PROXY_ADDRESS.toLowerCase()
    );
  } catch {
    return false;
  }
}

export function decodeX402PaymentDiagnostics(xPayment: string): X402PaymentDiagnostics | null {
  try {
    const decoded = JSON.parse(Buffer.from(xPayment, 'base64').toString('utf8')) as {
      payload?: {
        permit2Authorization?: {
          from?: string;
          deadline?: string;
          spender?: string;
          permitted?: { amount?: string };
        };
      };
      resource?: { url?: string };
    };
    const permit = decoded.payload?.permit2Authorization;
    if (!permit) return null;

    const now = Math.floor(Date.now() / 1000);
    const deadline = permit.deadline;
    const deadlineNumber = deadline ? Number(deadline) : NaN;
    const secondsRemaining = Number.isFinite(deadlineNumber) ? deadlineNumber - now : undefined;
    const maxTokens =
      permit.permitted?.amount != null ? Number(permit.permitted.amount) / 1e18 : undefined;

    return {
      payer: permit.from,
      deadline,
      deadlineIso: Number.isFinite(deadlineNumber)
        ? new Date(deadlineNumber * 1000).toISOString()
        : undefined,
      secondsRemaining,
      expired: secondsRemaining != null ? secondsRemaining <= 0 : undefined,
      maxTokens,
      resourceUrl: decoded.resource?.url,
      permit2Spender: permit.spender,
    };
  } catch {
    return null;
  }
}

function parsePaymentResponseHeader(headers: Headers): X402FacilitatorVerification | null {
  const paymentResponse =
    headers.get('payment-response') ||
    headers.get('PAYMENT-RESPONSE') ||
    headers.get('x-payment-response') ||
    headers.get('X-PAYMENT-RESPONSE');

  if (!paymentResponse) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(paymentResponse, 'base64').toString('utf8')
    ) as Record<string, unknown>;
    const invalidReason =
      (typeof decoded.errorReason === 'string' && decoded.errorReason) ||
      (typeof decoded.invalidReason === 'string' && decoded.invalidReason) ||
      null;
    if (!invalidReason) return null;
    return {
      message: formatFacilitatorInvalidReason(invalidReason),
      invalidReason,
      payer: typeof decoded.payer === 'string' ? decoded.payer : undefined,
    };
  } catch {
    return null;
  }
}

async function callBankrFacilitatorVerify(
  paymentPayload: unknown,
  paymentRequiredHeader: string
): Promise<X402FacilitatorVerification | null> {
  try {
    const paymentRequirements = JSON.parse(
      Buffer.from(paymentRequiredHeader, 'base64').toString('utf8')
    );
    const res = await fetch('https://api.bankr.bot/facilitator/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentPayload, paymentRequirements }),
      cache: 'no-store',
    });
    const data = (await res.json()) as {
      isValid?: boolean;
      invalidReason?: string;
      payer?: string;
      error?: string;
    };
    if (data.isValid === true) return null;

    if (typeof data.invalidReason === 'string') {
      return {
        message: formatFacilitatorInvalidReason(data.invalidReason),
        invalidReason: data.invalidReason,
        payer: data.payer,
      };
    }
    if (typeof data.error === 'string') {
      return { message: data.error, payer: data.payer };
    }
    return null;
  } catch {
    return null;
  }
}

function genericVerificationFailure(payment: X402PaymentDiagnostics): X402FacilitatorVerification {
  const seconds = payment.secondsRemaining;
  const timingHint =
    seconds != null && seconds > 0 && seconds <= 15
      ? ' Sign immediately when MetaMask opens.'
      : '';
  return {
    message:
      'Payment verification failed — hard refresh the page and try Contribute again.' + timingHint,
    payment,
  };
}

/** Surface the best rejection reason from upstream headers + signed payload. */
export async function verifyX402PaymentWithFacilitator(
  xPayment: string,
  paymentRequiredHeader?: string | null,
  headers?: Headers
): Promise<string | null> {
  const detail = await verifyX402PaymentWithFacilitatorDetail(
    xPayment,
    paymentRequiredHeader,
    headers
  );
  return detail?.message || null;
}

export async function verifyX402PaymentWithFacilitatorDetail(
  xPayment: string,
  paymentRequiredHeader?: string | null,
  headers?: Headers
): Promise<X402FacilitatorVerification | null> {
  let paymentPayload: unknown;
  try {
    paymentPayload = JSON.parse(Buffer.from(xPayment, 'base64').toString('utf8'));
  } catch {
    return null;
  }

  const payment = decodeX402PaymentDiagnostics(xPayment) || undefined;

  if (headers) {
    const fromResponse = parsePaymentResponseHeader(headers);
    if (fromResponse) {
      return { ...fromResponse, payment: fromResponse.payment || payment };
    }
  }

  if (payment?.expired) {
    return {
      message: formatFacilitatorInvalidReason('permit2_deadline_expired'),
      invalidReason: 'permit2_deadline_expired',
      payer: payment.payer,
      payment,
    };
  }

  if (paymentRequiredHeader && !isBankrFeeRouterPermit2Quote(paymentRequiredHeader)) {
    const fromFacilitator = await callBankrFacilitatorVerify(
      paymentPayload,
      paymentRequiredHeader
    );
    if (fromFacilitator) {
      return { ...fromFacilitator, payment: fromFacilitator.payment || payment };
    }
  }

  return payment ? genericVerificationFailure(payment) : null;
}
