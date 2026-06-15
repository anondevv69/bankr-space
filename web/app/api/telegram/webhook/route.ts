/**
 * POST /api/telegram/webhook
 * Receives all updates from Telegram and dispatches bot commands.
 *
 * Supported commands:
 *   /start        — welcome + link prompt
 *   /link         — generate a link code and send the link URL
 *   /unlink       — remove wallet↔Telegram link
 *   /post <text>  — create a post on the linked wallet's space(s)
 *   /balance      — check $Space balance of linked wallet
 *   /spaces       — list spaces where linked wallet can post
 *   /help         — command list
 */
import { NextResponse } from 'next/server';
import { createPublicClient, erc20Abi, formatUnits, http, type Address } from 'viem';
import { base } from 'viem/chains';
import {
  validateTelegramWebhookSecret,
  sendTelegramMessage,
  parseTelegramCommand,
  truncate,
  getTelegramBotUsername,
  type TelegramUpdate,
} from '@/lib/telegram-bot';
import {
  getTelegramLinkByTgId,
  removeTelegramLinkByWallet,
  setTelegramLinkCode,
} from '@/lib/telegram-kv';
import { getCommunities, getPosts, setPostsForToken, updateCommunityCounts } from '@/lib/db';
import { checkParticipation } from '@/lib/participation';
import { resolveAuthorProfile } from '@/lib/profiles';
import { communityUrl, getSiteUrl } from '@/lib/site-url';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SPACE_TOKEN = '0xef703b860a6d422fa00cc67bbbb2662297cb6ba3' as Address;
const BOT_USER_AGENT = 'BankrSpaceTelegramBot/1.0';

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

async function handleStart(chatId: number, botUsername: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `👋 Welcome to <b>Bankr Space</b>!\n\nThis bot lets you post to your community space and manage $Space from Telegram.\n\n<b>First, link your wallet:</b>\n→ /link\n\n<b>Commands:</b>\n/post &lt;text&gt; — post to your space\n/balance — check $Space\n/spaces — your spaces\n/unlink — remove wallet link\n/help — all commands`,
    { parseMode: 'HTML' }
  );
}

async function handleLink(
  chatId: number,
  telegramId: string,
  telegramUsername: string | null
): Promise<void> {
  const code = randomCode();
  await setTelegramLinkCode(code, telegramId, telegramUsername);
  const url = `${getSiteUrl()}/link-telegram?code=${code}`;

  await sendTelegramMessage(
    chatId,
    `🔗 <b>Link your wallet</b>\n\nTap the link below, connect MetaMask (on Base), and sign once:\n\n${url}\n\n⏳ Link expires in 10 minutes.`,
    { parseMode: 'HTML', disableWebPagePreview: false }
  );
}

async function handleUnlink(chatId: number, telegramId: string): Promise<void> {
  const link = await getTelegramLinkByTgId(telegramId);
  if (!link) {
    await sendTelegramMessage(chatId, 'No wallet is linked to your Telegram account.');
    return;
  }
  await removeTelegramLinkByWallet(link.wallet);
  await sendTelegramMessage(
    chatId,
    `✅ Wallet ${shortWallet(link.wallet)} unlinked. Use /link to connect a different wallet.`
  );
}

async function handleBalance(chatId: number, wallet: string): Promise<void> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
    });
    const [balance, symbol, decimals] = await Promise.all([
      client.readContract({ address: SPACE_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [wallet as Address] }),
      client.readContract({ address: SPACE_TOKEN, abi: erc20Abi, functionName: 'symbol' }).catch(() => 'Space'),
      client.readContract({ address: SPACE_TOKEN, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18),
    ]);
    const formatted = Number(formatUnits(balance, decimals)).toLocaleString(undefined, { maximumFractionDigits: 0 });
    await sendTelegramMessage(
      chatId,
      `💰 <b>Balance</b>\n${formatted} $${symbol}\n\nWallet: <code>${wallet}</code>`,
      { parseMode: 'HTML' }
    );
  } catch {
    await sendTelegramMessage(chatId, 'Failed to fetch balance — try again in a moment.');
  }
}

async function handleSpaces(chatId: number, wallet: string): Promise<void> {
  const communities = await getCommunities();
  const normalizedWallet = wallet.toLowerCase();
  const eligible = communities.filter(
    (c) =>
      c.ownerWallet?.toLowerCase() === normalizedWallet ||
      c.founderWallet?.toLowerCase() === normalizedWallet
  );

  if (!eligible.length) {
    await sendTelegramMessage(
      chatId,
      `No spaces found for wallet ${shortWallet(wallet)}.\n\nYou can post to any space where you hold the token — use /post to try.`
    );
    return;
  }

  const lines = eligible
    .slice(0, 10)
    .map((c) => `• <b>${c.symbol}</b> — ${communityUrl(c.tokenAddress)}`)
    .join('\n');

  await sendTelegramMessage(
    chatId,
    `🏘️ <b>Your Spaces</b>\n\n${lines}`,
    { parseMode: 'HTML' }
  );
}

async function handlePost(
  chatId: number,
  wallet: string,
  content: string,
  messageId: number,
  telegramUsername: string | null
): Promise<void> {
  if (!content) {
    await sendTelegramMessage(
      chatId,
      'Usage: /post &lt;your message&gt;\n\nExample: <code>/post GM Space holders! 🚀</code>',
      { parseMode: 'HTML', replyToMessageId: messageId }
    );
    return;
  }

  const trimmed = content.slice(0, 2000);
  const communities = await getCommunities();

  // Find communities the wallet can post in (holds token or is owner)
  const postable: typeof communities = [];
  for (const c of communities) {
    try {
      const participation = await checkParticipation(wallet, c.tokenAddress, c.chain || 'base');
      if (participation.canPost) postable.push(c);
    } catch {
      // skip
    }
    if (postable.length >= 5) break; // cap to avoid timeout
  }

  if (!postable.length) {
    await sendTelegramMessage(
      chatId,
      `⚠️ You don't hold any $Space or community tokens — can't post.\n\nHold the token to post in a space.`,
      { replyToMessageId: messageId }
    );
    return;
  }

  const author = await resolveAuthorProfile(wallet);
  const created: string[] = [];

  for (const c of postable.slice(0, 3)) {
    const posts = await getPosts(c.tokenAddress);
    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newPost: Post = {
      id: postId,
      wallet,
      author,
      content: trimmed,
      reactions: { '👍': [], '❤️': [], '🔥': [] },
      timestamp: Date.now(),
      balance: 0,
      source: {
        client: 'api',
        trigger: 'manual',
        viaAgent: false,
        externalRef: `telegram:${telegramUsername || chatId}`,
      },
    };
    posts.push(newPost);
    await setPostsForToken(c.tokenAddress, posts);
    await updateCommunityCounts(c.tokenAddress, posts);
    created.push(`• ${c.symbol} — ${communityUrl(c.tokenAddress)}`);
  }

  await sendTelegramMessage(
    chatId,
    `✅ <b>Posted!</b>\n\n${created.join('\n')}`,
    { parseMode: 'HTML', replyToMessageId: messageId }
  );
}

async function handleHelp(chatId: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `<b>Bankr Space Bot — Commands</b>\n\n/link — connect your wallet\n/unlink — remove wallet\n/post &lt;text&gt; — post to your space\n/balance — check $Space balance\n/spaces — list your spaces\n/help — this message`,
    { parseMode: 'HTML' }
  );
}

export async function POST(req: Request) {
  if (!validateTelegramWebhookSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text || !message.from) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const telegramId = String(message.from.id);
  const telegramUsername = message.from.username || null;
  const text = message.text.trim();
  const messageId = message.message_id;
  const botUsername = getTelegramBotUsername();

  const parsed = parseTelegramCommand(text);

  // Not a command — ignore (could support free-form posting later)
  if (!parsed) {
    return NextResponse.json({ ok: true });
  }

  const { command, args } = parsed;

  // Commands that don't need a linked wallet
  if (command === 'start') {
    await handleStart(chatId, botUsername);
    return NextResponse.json({ ok: true });
  }
  if (command === 'help') {
    await handleHelp(chatId);
    return NextResponse.json({ ok: true });
  }
  if (command === 'link') {
    await handleLink(chatId, telegramId, telegramUsername);
    return NextResponse.json({ ok: true });
  }

  // Commands that require a linked wallet
  const link = await getTelegramLinkByTgId(telegramId);

  if (command === 'unlink') {
    await handleUnlink(chatId, telegramId);
    return NextResponse.json({ ok: true });
  }

  if (!link) {
    await sendTelegramMessage(
      chatId,
      `No wallet linked yet. Use /link to connect your wallet first.`,
      { replyToMessageId: messageId }
    );
    return NextResponse.json({ ok: true });
  }

  switch (command) {
    case 'balance':
      await handleBalance(chatId, link.wallet);
      break;
    case 'spaces':
      await handleSpaces(chatId, link.wallet);
      break;
    case 'post':
      await handlePost(chatId, link.wallet, args, messageId, telegramUsername);
      break;
    default:
      await sendTelegramMessage(
        chatId,
        `Unknown command /${command}. Type /help for a list of commands.`,
        { replyToMessageId: messageId }
      );
  }

  return NextResponse.json({ ok: true });
}
