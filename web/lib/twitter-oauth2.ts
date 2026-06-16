import crypto from 'crypto';
import { getSiteUrl } from '@/lib/site-url';
import {
  getTwitterOAuth2Tokens,
  setTwitterOAuth2Tokens,
  type TwitterOAuth2Tokens,
} from '@/lib/twitter-oauth2-store';

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] as const;

function readClientId(): string | null {
  return process.env.TWITTER_CLIENT_ID?.trim() || null;
}

function readClientSecret(): string | null {
  return process.env.TWITTER_CLIENT_SECRET?.trim() || null;
}

export function isTwitterOAuth2ClientConfigured(): boolean {
  return !!readClientId();
}

export function twitterOAuth2RedirectUri(): string {
  const fromEnv = process.env.TWITTER_OAUTH2_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return `${getSiteUrl()}/api/twitter/callback`;
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function buildTwitterAuthorizeUrl(state: string, codeChallenge: string): string {
  const clientId = readClientId();
  if (!clientId) throw new Error('TWITTER_CLIENT_ID is not set');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: twitterOAuth2RedirectUri(),
    scope: SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const encoded = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString(
    'base64'
  );
  return `Basic ${encoded}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

async function parseTokenResponse(res: Response): Promise<TokenResponse> {
  return (await res.json().catch(() => ({}))) as TokenResponse;
}

export async function exchangeTwitterAuthorizationCode(
  code: string,
  codeVerifier: string
): Promise<TwitterOAuth2Tokens> {
  const clientId = readClientId();
  const clientSecret = readClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET are required');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: twitterOAuth2RedirectUri(),
    code_verifier: codeVerifier,
    client_id: clientId,
  });

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(clientId, clientSecret),
    },
    body,
  });

  const data = await parseTokenResponse(res);
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token exchange failed (${res.status})`);
  }

  const profile = await fetchTwitterUserProfile(data.access_token);
  const expiresIn = Number(data.expires_in || 7200);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: data.scope || SCOPES.join(' '),
    username: profile.username,
    userId: profile.id,
    updatedAt: Date.now(),
  };
}

export async function refreshTwitterAccessToken(
  refreshToken: string
): Promise<TwitterOAuth2Tokens> {
  const clientId = readClientId();
  const clientSecret = readClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET are required');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(clientId, clientSecret),
    },
    body,
  });

  const data = await parseTokenResponse(res);
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token refresh failed (${res.status})`);
  }

  const existing = await getTwitterOAuth2Tokens();
  const profile = await fetchTwitterUserProfile(data.access_token);
  const expiresIn = Number(data.expires_in || 7200);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: data.scope || existing?.scope || SCOPES.join(' '),
    username: profile.username || existing?.username || null,
    userId: profile.id || existing?.userId || null,
    updatedAt: Date.now(),
  };
}

async function fetchTwitterUserProfile(
  accessToken: string
): Promise<{ id: string | null; username: string | null }> {
  try {
    const res = await fetch('https://api.twitter.com/2/users/me?user.fields=username', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as { data?: { id?: string; username?: string } };
    return {
      id: data.data?.id || null,
      username: data.data?.username || null,
    };
  } catch {
    return { id: null, username: null };
  }
}

/** Returns a valid OAuth2 access token, refreshing when needed. */
export async function getValidTwitterOAuth2AccessToken(): Promise<string | null> {
  const fromEnv = process.env.TWITTER_OAUTH2_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  let tokens = await getTwitterOAuth2Tokens();
  if (!tokens?.accessToken) return null;

  const refreshBufferMs = 60_000;
  if (tokens.expiresAt > Date.now() + refreshBufferMs) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    console.error('[twitter] OAuth2 access token expired and no refresh token stored');
    return null;
  }

  try {
    tokens = await refreshTwitterAccessToken(tokens.refreshToken);
    await setTwitterOAuth2Tokens(tokens);
    return tokens.accessToken;
  } catch (err) {
    console.error('[twitter] OAuth2 refresh failed', err);
    return null;
  }
}
