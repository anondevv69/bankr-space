import crypto from 'crypto';
import {
  getValidTwitterOAuth2AccessToken,
  isTwitterOAuth2ClientConfigured,
} from '@/lib/twitter-oauth2';
import { getTwitterOAuth2Tokens } from '@/lib/twitter-oauth2-store';

type TwitterOAuth1Credentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

export type TwitterAuthMode = 'oauth2' | 'oauth1' | 'none';

export type TwitterAccountStatus = {
  configured: boolean;
  authMode: TwitterAuthMode;
  username: string | null;
  userId: string | null;
  tokenExpiresAt: number | null;
  oauth2ConnectAvailable: boolean;
};

function readOAuth1Credentials(): TwitterOAuth1Credentials | null {
  const apiKey = process.env.TWITTER_API_KEY?.trim();
  const apiSecret = process.env.TWITTER_API_SECRET?.trim();
  const accessToken = process.env.TWITTER_ACCESS_TOKEN?.trim();
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET?.trim();
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}

export function isTwitterBotEnabled(): boolean {
  return process.env.TWITTER_BOT_ENABLED?.trim() !== 'false';
}

export function isTwitterBotConfigured(): boolean {
  if (!isTwitterBotEnabled()) return false;
  if (process.env.TWITTER_OAUTH2_ACCESS_TOKEN?.trim()) return true;
  if (isTwitterOAuth2ClientConfigured()) return true;
  return readOAuth1Credentials() !== null;
}

export async function getTwitterAuthMode(): Promise<TwitterAuthMode> {
  const oauth2Token = await getValidTwitterOAuth2AccessToken();
  if (oauth2Token) return 'oauth2';
  if (readOAuth1Credentials()) return 'oauth1';
  return 'none';
}

export async function getTwitterAccountStatus(): Promise<TwitterAccountStatus> {
  const oauth2ConnectAvailable = isTwitterOAuth2ClientConfigured();
  const stored = await getTwitterOAuth2Tokens();

  if (process.env.TWITTER_OAUTH2_ACCESS_TOKEN?.trim()) {
    return {
      configured: isTwitterBotConfigured(),
      authMode: 'oauth2',
      username: stored?.username || null,
      userId: stored?.userId || null,
      tokenExpiresAt: null,
      oauth2ConnectAvailable,
    };
  }

  if (stored?.accessToken) {
    return {
      configured: isTwitterBotConfigured(),
      authMode: 'oauth2',
      username: stored.username,
      userId: stored.userId,
      tokenExpiresAt: stored.expiresAt,
      oauth2ConnectAvailable,
    };
  }

  if (readOAuth1Credentials()) {
    return {
      configured: isTwitterBotConfigured(),
      authMode: 'oauth1',
      username: process.env.TWITTER_BOT_USERNAME?.trim() || null,
      userId: null,
      tokenExpiresAt: null,
      oauth2ConnectAvailable,
    };
  }

  return {
    configured: false,
    authMode: 'none',
    username: null,
    userId: null,
    tokenExpiresAt: null,
    oauth2ConnectAvailable,
  };
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function oauth1AuthorizationHeader(
  method: string,
  url: string,
  creds: TwitterOAuth1Credentials
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  const paramString = Object.keys(oauth)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauth[key])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(creds.apiSecret)}&${percentEncode(creds.accessTokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauth.oauth_signature = signature;

  return (
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((key) => `${percentEncode(key)}="${percentEncode(oauth[key])}"`)
      .join(', ')
  );
}

export type PostTweetResult =
  | { ok: true; id: string; text: string; authMode: TwitterAuthMode }
  | { ok: false; error: string; status?: number; authMode?: TwitterAuthMode };

/** Post a tweet via official X API v2. Prefers OAuth 2.0, falls back to OAuth 1.0a. */
export async function postTweet(text: string): Promise<PostTweetResult> {
  if (!isTwitterBotConfigured()) {
    return { ok: false, error: 'X API credentials not configured' };
  }

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Tweet text is empty' };
  if (trimmed.length > 280) {
    return { ok: false, error: `Tweet too long (${trimmed.length}/280)` };
  }

  if (process.env.TWITTER_BOT_DRY_RUN?.trim() === 'true') {
    const authMode = await getTwitterAuthMode();
    console.info('[twitter] dry run tweet', { authMode, trimmed });
    return { ok: true, id: 'dry-run', text: trimmed, authMode };
  }

  const oauth2Token = await getValidTwitterOAuth2AccessToken();
  if (oauth2Token) {
    return postTweetOAuth2(trimmed, oauth2Token);
  }

  const oauth1 = readOAuth1Credentials();
  if (oauth1) {
    return postTweetOAuth1(trimmed, oauth1);
  }

  return {
    ok: false,
    error: 'Connect @BankrSpace via /api/twitter/connect or set X API credentials in Vercel',
  };
}

async function postTweetOAuth2(text: string, accessToken: string): Promise<PostTweetResult> {
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  return parseTweetResponse(res, text, 'oauth2');
}

async function postTweetOAuth1(
  text: string,
  creds: TwitterOAuth1Credentials
): Promise<PostTweetResult> {
  const url = 'https://api.twitter.com/2/tweets';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: oauth1AuthorizationHeader('POST', url, creds),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  return parseTweetResponse(res, text, 'oauth1');
}

async function parseTweetResponse(
  res: Response,
  fallbackText: string,
  authMode: TwitterAuthMode
): Promise<PostTweetResult> {
  const data = (await res.json().catch(() => ({}))) as {
    data?: { id?: string; text?: string };
    errors?: { message?: string; detail?: string }[];
    detail?: string;
    title?: string;
  };

  if (!res.ok) {
    const err =
      data.errors?.map((e) => e.detail || e.message).filter(Boolean).join('; ') ||
      data.detail ||
      data.title ||
      `HTTP ${res.status}`;
    console.error('[twitter] post failed', { status: res.status, authMode, data });
    return { ok: false, error: err, status: res.status, authMode };
  }

  const id = data.data?.id;
  if (!id) {
    return { ok: false, error: 'Tweet posted but no id returned', status: res.status, authMode };
  }

  return { ok: true, id, text: data.data?.text || fallbackText, authMode };
}
