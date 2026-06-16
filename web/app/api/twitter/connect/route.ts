/**
 * GET /api/twitter/connect?secret=SITE_ADMIN_SECRET
 * Starts X OAuth 2.0 PKCE — redirects to authorize @BankrSpace (or your bot account).
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  buildTwitterAuthorizeUrl,
  generatePkcePair,
  isTwitterOAuth2ClientConfigured,
  twitterOAuth2RedirectUri,
} from '@/lib/twitter-oauth2';
import { setTwitterOAuthPending } from '@/lib/twitter-oauth2-store';

export const dynamic = 'force-dynamic';

function checkAdmin(req: Request): boolean {
  const adminSecret = process.env.SITE_ADMIN_SECRET?.trim();
  if (!adminSecret) return true;
  const { searchParams } = new URL(req.url);
  return searchParams.get('secret') === adminSecret;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isTwitterOAuth2ClientConfigured()) {
    return NextResponse.json(
      {
        error: 'Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in Vercel first',
        redirectUri: twitterOAuth2RedirectUri(),
        docs: 'https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code',
      },
      { status: 400 }
    );
  }

  const state = crypto.randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = generatePkcePair();

  await setTwitterOAuthPending(state, {
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const authorizeUrl = buildTwitterAuthorizeUrl(state, codeChallenge);
  return NextResponse.redirect(authorizeUrl);
}
