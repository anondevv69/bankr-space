import { normalizeAddr } from './utils';

const DEFAULT_SITE_ADMIN_WALLET = '0xbFF8c6C34f1EFacF6844350dE907Cca6F07C76b8';

export function getSiteAdminWallet(): string | null {
  const raw =
    process.env.SITE_ADMIN_WALLET?.trim() ||
    process.env.NEXT_PUBLIC_SITE_ADMIN_WALLET?.trim() ||
    DEFAULT_SITE_ADMIN_WALLET;
  try {
    return normalizeAddr(raw);
  } catch {
    return null;
  }
}

export function isSiteAdminWallet(wallet: string | undefined | null): boolean {
  if (!wallet) return false;
  const admin = getSiteAdminWallet();
  if (!admin) return false;
  return wallet.toLowerCase() === admin.toLowerCase();
}
