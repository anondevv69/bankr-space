/** Headers for server-side proxy requests to Bankr x402 v2 endpoints. */
export function x402ProxyPaymentHeaders(paymentSignature: string): HeadersInit {
  return {
    Accept: 'application/json',
    'PAYMENT-SIGNATURE': paymentSignature,
    'Access-Control-Expose-Headers': 'PAYMENT-RESPONSE, X-PAYMENT-RESPONSE',
  };
}
