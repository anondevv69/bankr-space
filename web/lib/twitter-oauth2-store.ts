import { kvGet, kvSet } from '@/lib/kv-store';

export type TwitterOAuth2Tokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scope: string | null;
  username: string | null;
  userId: string | null;
  updatedAt: number;
};

const TOKENS_KEY = 'tw:oauth2:tokens';
const PENDING_PREFIX = 'tw:oauth2:pending:';

export async function getTwitterOAuth2Tokens(): Promise<TwitterOAuth2Tokens | null> {
  return kvGet<TwitterOAuth2Tokens>(TOKENS_KEY);
}

export async function setTwitterOAuth2Tokens(tokens: TwitterOAuth2Tokens): Promise<void> {
  await kvSet(TOKENS_KEY, tokens);
}

export async function clearTwitterOAuth2Tokens(): Promise<void> {
  await kvSet(TOKENS_KEY, null);
}

export type TwitterOAuthPending = {
  codeVerifier: string;
  expiresAt: number;
};

export async function setTwitterOAuthPending(
  state: string,
  pending: TwitterOAuthPending
): Promise<void> {
  await kvSet(`${PENDING_PREFIX}${state}`, pending);
}

export async function getTwitterOAuthPending(state: string): Promise<TwitterOAuthPending | null> {
  const value = await kvGet<TwitterOAuthPending>(`${PENDING_PREFIX}${state}`);
  if (!value) return null;
  if (Date.now() > value.expiresAt) return null;
  return value;
}

export async function deleteTwitterOAuthPending(state: string): Promise<void> {
  await kvSet(`${PENDING_PREFIX}${state}`, null);
}
