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
      return 'Permit2 allowance missing — approve $Space for Permit2 in your wallet, then try again.';
    case 'invalid_permit2_recipient_mismatch':
      return 'Payment destination mismatch — refresh the page and try Contribute again.';
    case 'invalid_permit2_spender':
    case 'permit2_spender_mismatch':
      return 'Payment signature format rejected — refresh the page and try Contribute again.';
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
};

export type X402FacilitatorVerification = {
  message: string;
  invalidReason?: string;
  payer?: string;
  payment?: X402PaymentDiagnostics;
};

export function decodeX402PaymentDiagnostics(xPayment: string): X402PaymentDiagnostics | null {
  try {
    const decoded = JSON.parse(Buffer.from(xPayment, 'base64').toString('utf8')) as {
      payload?: {
        permit2Authorization?: {
          from?: string;
          deadline?: string;
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
  void paymentRequiredHeader;
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

  if (payment?.secondsRemaining != null && payment.secondsRemaining <= 0) {
    return {
      message: formatFacilitatorInvalidReason('permit2_deadline_expired'),
      invalidReason: 'permit2_deadline_expired',
      payer: payment.payer,
      payment,
    };
  }

  return payment ? { message: 'Payment verification failed', payment } : null;
}
