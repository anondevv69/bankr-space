/**
 * GET /api/twitter/callback?code=…&state=…
 * Completes X OAuth 2.0 and stores tokens for the bot account.
 */
import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/site-url';
import { exchangeTwitterAuthorizationCode } from '@/lib/twitter-oauth2';
import {
  deleteTwitterOAuthPending,
  getTwitterOAuthPending,
  setTwitterOAuth2Tokens,
} from '@/lib/twitter-oauth2-store';

export const dynamic = 'force-dynamic';

function htmlPage(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title></head><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5">${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return htmlPage(
      'X connection failed',
      `<h1>X connection failed</h1><p>${errorDescription || error}</p><p><a href="${getSiteUrl()}">Back to bankr.space</a></p>`
    );
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) {
    return htmlPage(
      'X connection failed',
      `<h1>Missing code or state</h1><p>Start again from <code>/api/twitter/connect</code>.</p>`
    );
  }

  const pending = await getTwitterOAuthPending(state);
  if (!pending) {
    return htmlPage(
      'X connection expired',
      `<h1>Link expired</h1><p>Open <code>/api/twitter/connect</code> again and authorize within 10 minutes.</p>`
    );
  }

  try {
    const tokens = await exchangeTwitterAuthorizationCode(code, pending.codeVerifier);
    await setTwitterOAuth2Tokens(tokens);
    await deleteTwitterOAuthPending(state);

    const handle = tokens.username ? `@${tokens.username}` : 'your X account';
    return htmlPage(
      'X bot connected',
      [
        `<h1>✅ X bot connected</h1>`,
        `<p>Posting as <strong>${handle}</strong>.</p>`,
        `<p>bankr.space will tweet when spaces are <strong>created</strong> and <strong>verified</strong>.</p>`,
        `<p><a href="${getSiteUrl()}/api/twitter/status">Check status</a> · <a href="${getSiteUrl()}">bankr.space</a></p>`,
      ].join('')
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return htmlPage(
      'X connection failed',
      `<h1>Token exchange failed</h1><p>${message}</p><p>Check redirect URI matches <code>${getSiteUrl()}/api/twitter/callback</code> in the X developer portal.</p>`
    );
  }
}
