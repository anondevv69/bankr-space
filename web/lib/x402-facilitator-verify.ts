/** Decode Bankr facilitator verify invalidReason into a user-facing message. */
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
      return 'Permit2 allowance missing — approve $Space for Permit2 in your wallet, then try again.';
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

/** Call Bankr facilitator /verify to surface the real rejection reason (server-side). */
export async function verifyX402PaymentWithFacilitator(
  xPayment: string,
  paymentRequiredHeader?: string | null
): Promise<string | null> {
  const detail = await verifyX402PaymentWithFacilitatorDetail(xPayment, paymentRequiredHeader);
  return detail?.message || null;
}

export async function verifyX402PaymentWithFacilitatorDetail(
  xPayment: string,
  paymentRequiredHeader?: string | null
): Promise<X402FacilitatorVerification | null> {
  const payment = decodeX402PaymentDiagnostics(xPayment) || undefined;
  try {
    let paymentPayload: unknown;
    try {
      paymentPayload = JSON.parse(Buffer.from(xPayment, 'base64').toString('utf8'));
    } catch {
      return null;
    }

    let paymentRequirements: unknown = null;
    if (paymentRequiredHeader) {
      try {
        paymentRequirements = JSON.parse(
          Buffer.from(paymentRequiredHeader, 'base64').toString('utf8')
        );
      } catch {
        /* fall through */
      }
    }

    const body: Record<string, unknown> = { paymentPayload };
    if (paymentRequirements) {
      body.paymentRequirements = paymentRequirements;
    }

    const res = await fetch('https://api.bankr.bot/facilitator/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
        payment,
      };
    }
    if (typeof data.error === 'string') return { message: data.error, payer: data.payer, payment };
    return null;
  } catch {
    if (payment?.expired) {
      return {
        message: formatFacilitatorInvalidReason('permit2_deadline_expired'),
        invalidReason: 'permit2_deadline_expired',
        payer: payment.payer,
        payment,
      };
    }
    return payment ? { message: 'Payment verification failed', payment } : null;
  }
}
