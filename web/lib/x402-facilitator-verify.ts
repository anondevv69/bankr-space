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

/** Call Bankr facilitator /verify to surface the real rejection reason (server-side). */
export async function verifyX402PaymentWithFacilitator(
  xPayment: string,
  paymentRequiredHeader?: string | null
): Promise<string | null> {
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
      error?: string;
    };

    if (data.isValid === true) return null;
    if (typeof data.invalidReason === 'string') {
      return formatFacilitatorInvalidReason(data.invalidReason);
    }
    if (typeof data.error === 'string') return data.error;
    return null;
  } catch {
    return null;
  }
}
