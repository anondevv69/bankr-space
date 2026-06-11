import { kvAcquireLock, kvReleaseLock } from './kv-store';

const ISSUER_LOCK_KEY = 'poidh:issuer:tx';
const LOCK_TTL_SEC = 120;

export type PoidhIssuerLockResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'locked' };

export async function withPoidhIssuerLock<T>(
  fn: () => Promise<T>
): Promise<PoidhIssuerLockResult<T>> {
  const acquired = await kvAcquireLock(ISSUER_LOCK_KEY, LOCK_TTL_SEC);
  if (!acquired) {
    return { ok: false, reason: 'locked' };
  }
  try {
    return { ok: true, value: await fn() };
  } finally {
    await kvReleaseLock(ISSUER_LOCK_KEY).catch(() => undefined);
  }
}
