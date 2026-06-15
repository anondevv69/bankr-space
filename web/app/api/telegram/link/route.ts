/**
 * POST /api/telegram/link
 *
 * Two-phase wallet↔Telegram linking:
 *
 * Phase 1 — called by bot after /link command:
 *   body: { telegramId, telegramUsername, code }
 *   Stores the pending link code so the web page can consume it.
 *   Authenticated by TELEGRAM_INTERNAL_SECRET (bot→server).
 *
 * Phase 2 — called by the /link-telegram web page after MetaMask signs:
 *   body: { code, wallet, signature }
 *   Verifies EIP-191 signature, then writes the permanent link.
 */
import { NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import type { Address } from 'viem';
import {
  getTelegramLinkCode,
  setTelegramLinkCode,
  deleteTelegramLinkCode,
  setTelegramLink,
  getTelegramLinkByWallet,
} from '@/lib/telegram-kv';
import { sendTelegramMessage } from '@/lib/telegram-bot';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function linkMessage(wallet: string, code: string): string {
  return `Link Telegram to wallet ${wallet} on bankr.space\n\nCode: ${code}`;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Phase 1: bot registers a pending code ──────────────────────────────
  if (body.phase === 'register' || body.telegramId) {
    const internalSecret = process.env.TELEGRAM_INTERNAL_SECRET?.trim();
    const providedSecret = req.headers.get('x-telegram-internal-secret');
    if (internalSecret && providedSecret !== internalSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const telegramId = String(body.telegramId || '').trim();
    const telegramUsername = body.telegramUsername
      ? String(body.telegramUsername).trim()
      : null;

    if (!telegramId) {
      return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
    }

    const code = randomCode();
    await setTelegramLinkCode(code, telegramId, telegramUsername);
    const url = `${getSiteUrl()}/link-telegram?code=${code}`;

    return NextResponse.json({ code, url });
  }

  // ── Phase 2: web page submits wallet + signature ───────────────────────
  const code = String(body.code || '').trim();
  const wallet = String(body.wallet || '').trim().toLowerCase() as Address;
  const signature = String(body.signature || '').trim();

  if (!code || !wallet || !signature) {
    return NextResponse.json(
      { error: 'code, wallet, and signature are required' },
      { status: 400 }
    );
  }

  const pending = await getTelegramLinkCode(code);
  if (!pending) {
    return NextResponse.json(
      { error: 'Link code expired or not found. Ask the bot for a new link.' },
      { status: 400 }
    );
  }

  // Verify EIP-191 signature
  const message = linkMessage(wallet, code);
  let valid = false;
  try {
    valid = await verifyMessage({
      address: wallet,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json(
      { error: 'Signature verification failed — make sure you signed with the correct wallet.' },
      { status: 400 }
    );
  }

  // Check if this wallet is already linked to a different Telegram account
  const existing = await getTelegramLinkByWallet(wallet);
  if (existing && existing.telegramId !== pending.telegramId) {
    return NextResponse.json(
      {
        error: `This wallet is already linked to @${existing.telegramUsername || existing.telegramId}. Unlink it first with /unlink in the bot.`,
      },
      { status: 409 }
    );
  }

  await setTelegramLink(wallet, pending.telegramId, pending.telegramUsername);
  await deleteTelegramLinkCode(code);

  // Notify the user in Telegram
  try {
    const display = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
    await sendTelegramMessage(
      Number(pending.telegramId),
      `✅ Wallet ${display} linked!\n\nYou can now:\n• /post <text> — post to your space\n• /balance — check $Space balance\n• /spaces — list your spaces\n\nType /help for all commands.`
    );
  } catch {
    // Non-fatal — link is saved
  }

  return NextResponse.json({
    success: true,
    wallet,
    telegramId: pending.telegramId,
    telegramUsername: pending.telegramUsername,
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim();
  if (!code) {
    return NextResponse.json({ error: 'code required' }, { status: 400 });
  }

  const pending = await getTelegramLinkCode(code);
  if (!pending) {
    return NextResponse.json({ valid: false, error: 'Code expired or not found' });
  }

  return NextResponse.json({
    valid: true,
    telegramUsername: pending.telegramUsername,
    expiresAt: pending.expiresAt,
  });
}
