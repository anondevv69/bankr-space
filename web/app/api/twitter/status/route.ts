/**
 * GET  /api/twitter/status — X API connection status
 * POST /api/twitter/test?secret=SITE_ADMIN_SECRET — post a test tweet
 * DELETE /api/twitter/status?secret=SITE_ADMIN_SECRET — disconnect OAuth2 tokens
 */
import { NextResponse } from 'next/server';
import {
  getTwitterAccountStatus,
  isTwitterBotConfigured,
  postTweet,
} from '@/lib/twitter-api';
import { clearTwitterOAuth2Tokens } from '@/lib/twitter-oauth2-store';
import { twitterOAuth2RedirectUri } from '@/lib/twitter-oauth2';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

function checkAdmin(req: Request): boolean {
  const adminSecret = process.env.SITE_ADMIN_SECRET?.trim();
  if (!adminSecret) return true;
  const { searchParams } = new URL(req.url);
  return searchParams.get('secret') === adminSecret;
}

export async function GET() {
  const account = await getTwitterAccountStatus();
  const site = getSiteUrl();

  return NextResponse.json({
    configured: account.configured,
    authMode: account.authMode,
    username: account.username,
    userId: account.userId,
    tokenExpiresAt: account.tokenExpiresAt,
    dryRun: process.env.TWITTER_BOT_DRY_RUN?.trim() === 'true',
    events: ['space_created', 'space_verified', 'petition_created'],
    oauth2: {
      connectUrl: account.oauth2ConnectAvailable
        ? `${site}/api/twitter/connect`
        : null,
      callbackUrl: twitterOAuth2RedirectUri(),
      clientConfigured: account.oauth2ConnectAvailable,
    },
    setup: {
      step1: 'Create a project at https://developer.x.com (Basic tier or higher)',
      step2: `Add callback URL: ${twitterOAuth2RedirectUri()}`,
      step3: 'Set TWITTER_CLIENT_ID + TWITTER_CLIENT_SECRET in Vercel',
      step4: `Visit ${site}/api/twitter/connect?secret=YOUR_SITE_ADMIN_SECRET`,
      step5: `POST ${site}/api/twitter/test?secret=YOUR_SITE_ADMIN_SECRET`,
    },
  });
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isTwitterBotConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Connect X first via /api/twitter/connect or set API credentials in Vercel',
        statusUrl: `${getSiteUrl()}/api/twitter/status`,
      },
      { status: 400 }
    );
  }

  const result = await postTweet(
    '🧪 bankr.space X bot connected via API — space create & verify tweets are live.'
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, authMode: result.authMode },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    tweetId: result.id,
    text: result.text,
    authMode: result.authMode,
  });
}

export async function DELETE(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await clearTwitterOAuth2Tokens();
  return NextResponse.json({ ok: true, disconnected: true });
}
