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

  if (typeof data.error === 'string') return data.error;
  return 'x402 payment failed';
}
