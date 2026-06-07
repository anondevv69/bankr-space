export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return '—';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

export function normalizeAddr(addr: string): string {
  return addr.toLowerCase();
}

export function stripAt(username: string): string {
  const u = String(username || '');
  return u.charAt(0) === '@' ? u.slice(1) : u;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getWalletFromRequest(req: Request): string | null {
  const header = req.headers.get('x-wallet-address');
  if (header && /^0x[a-fA-F0-9]{40}$/.test(header)) {
    return header.toLowerCase();
  }
  return null;
}
