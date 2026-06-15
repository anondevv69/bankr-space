import {
  formatFacilitatorInvalidReason,
  type X402FacilitatorVerification,
  verifyX402PaymentWithFacilitator,
  verifyX402PaymentWithFacilitatorDetail,
} from '@/lib/x402-facilitator-verify';

/** Parse Bankr x402 upstream error bodies and PAYMENT-RESPONSE headers (server-side). */
export function parseX402UpstreamError(
  data: Record<string, unknown>,
  headers: Headers
): string {
  const paymentResponse =
    headers.get('payment-response') ||
    headers.get('PAYMENT-RESPONSE') ||
    headers.get('x-payment-response') ||
    headers.get('X-PAYMENT-RESPONSE');

  if (paymentResponse) {
    try {
      const decoded = JSON.parse(
        Buffer.from(paymentResponse, 'base64').toString('utf8')
      ) as Record<string, unknown>;
      const reason = decoded.errorReason || decoded.error;
      const message = decoded.errorMessage || decoded.message;
      if (typeof reason === 'string' && typeof message === 'string' && message !== reason) {
        return `${reason}: ${message}`;
      }
      if (typeof reason === 'string') return reason;
      if (typeof message === 'string') return message;
    } catch {
      /* fall through */
    }
  }

  if (typeof data.error === 'string') {
    if (data.error.toLowerCase().includes('already used')) {
      return formatFacilitatorInvalidReason('payment_already_used');
    }
    return data.error;
  }
  return 'x402 payment failed';
}

/** Enrich generic upstream errors with facilitator invalidReason when available. */
export async function parseX402UpstreamErrorDetailed(
  data: Record<string, unknown>,
  headers: Headers,
  xPayment?: string,
  paymentRequiredHeader?: string | null
): Promise<string> {
  const base = parseX402UpstreamError(data, headers);
  if (!xPayment) return base;

  const detail = await verifyX402PaymentWithFacilitator(xPayment, paymentRequiredHeader, headers);
  return detail || base;
}

export async function getX402UpstreamErrorDetail(
  xPayment?: string,
  paymentRequiredHeader?: string | null,
  headers?: Headers
): Promise<X402FacilitatorVerification | null> {
  if (!xPayment) return null;
  return verifyX402PaymentWithFacilitatorDetail(xPayment, paymentRequiredHeader, headers);
}
