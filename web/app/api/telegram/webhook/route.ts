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
  getTelegramLinkCode,
  attachTelegramToLinkCode,
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

async function handleWebLinkStart(
  chatId: number,
  telegramId: string,
  telegramUsername: string | null,
  code: string
): Promise<void> {
  const pending = await getTelegramLinkCode(code);
  if (!pending?.wallet) {
    await sendTelegramMessage(
      chatId,
      'This link expired or is invalid. Go to bankr.space/profile and tap Connect Telegram again.'
    );
    return;
  }

  const attached = await attachTelegramToLinkCode(code, telegramId, telegramUsername);
  if (!attached) {
    await sendTelegramMessage(
      chatId,
      'This link was already used. Start again from bankr.space/profile.'
    );
    return;
  }

  const signUrl = `${getSiteUrl()}/link-telegram?code=${code}`;
  await sendTelegramMessage(
    chatId,
    [
      '✅ <b>Telegram connected!</b>',
      '',
      'Last step — sign with your wallet on bankr.space:',
      signUrl,
      '',
      '⏳ Link expires in 10 minutes.',
    ].join('\n'),
    { parseMode: 'HTML', disableWebPagePreview: false }
  );
}

async function handleStart(chatId: number, botUsername: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    [
      '👋 Welcome to <b>Bankr Space</b>!',
      '',
      'Post to your community space and manage $Space from Telegram.',
      '',
      '<b>First, link your wallet:</b>',
      '→ /link',
      '',
      '<b>Then post:</b>',
      '<code>/post $SYMBOL your message</code>',
      '',
      '/spaces — see your spaces',
      '/balance — check $Space',
      '/help — all commands',
    ].join('\n'),
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

/** Returns all spaces the wallet is eligible to post in, capped at 20. */
async function getPostableSpaces(wallet: string) {
  const communities = await getCommunities();
  const postable: typeof communities = [];
  for (const c of communities) {
    try {
      const participation = await checkParticipation(wallet, c.tokenAddress, c.chain || 'base');
      if (participation.canPost) postable.push(c);
    } catch {
      // skip
    }
    if (postable.length >= 20) break;
  }
  return postable;
}

async function handleSpaces(chatId: number, wallet: string): Promise<void> {
  const postable = await getPostableSpaces(wallet);

  if (!postable.length) {
    await sendTelegramMessage(
      chatId,
      `No spaces found for wallet ${shortWallet(wallet)}.\n\nHold a community token to post in its space.`
    );
    return;
  }

  const lines = postable
    .slice(0, 15)
    .map((c, i) => `${i + 1}. <b>$${c.symbol}</b> — ${communityUrl(c.tokenAddress)}`)
    .join('\n');

  await sendTelegramMessage(
    chatId,
    `🏘️ <b>Your Spaces (${postable.length})</b>\n\n${lines}\n\nPost to a space:\n<code>/post $SYMBOL your message</code>`,
    { parseMode: 'HTML' }
  );
}

/**
 * Parse `/post $SYMBOL text` or `/post text` from args.
 * Returns { symbol, content } where symbol may be null.
 */
function parsePostArgs(args: string): { symbol: string | null; content: string } {
  // Match leading $SYMBOL (letters/digits/underscore)
  const match = args.match(/^\$([A-Za-z0-9_]+)\s+([\s\S]+)$/);
  if (match) {
    return { symbol: match[1].toUpperCase(), content: match[2].trim() };
  }
  return { symbol: null, content: args.trim() };
}

async function handlePost(
  chatId: number,
  wallet: string,
  rawArgs: string,
  messageId: number,
  telegramUsername: string | null
): Promise<void> {
  const { symbol, content } = parsePostArgs(rawArgs);

  if (!rawArgs.trim()) {
    await sendTelegramMessage(
      chatId,
      [
        '📝 <b>Post to a space</b>',
        '',
        'To post to a specific space:',
        '<code>/post $SYMBOL your message here</code>',
        '',
        'Example:',
        '<code>/post $SPACE GM everyone! 🚀</code>',
        '',
        'See your spaces: /spaces',
      ].join('\n'),
      { parseMode: 'HTML', replyToMessageId: messageId }
    );
    return;
  }

  const postable = await getPostableSpaces(wallet);

  if (!postable.length) {
    await sendTelegramMessage(
      chatId,
      `⚠️ You don't hold any community tokens — can't post.\n\nHold a token to post in its space.`,
      { replyToMessageId: messageId }
    );
    return;
  }

  // Resolve target community
  let target = postable.length === 1 ? postable[0] : null;

  if (symbol) {
    // Explicit $SYMBOL match
    target = postable.find((c) => c.symbol.toUpperCase() === symbol) || null;
    if (!target) {
      const available = postable.map((c) => `$${c.symbol}`).join(', ');
      await sendTelegramMessage(
        chatId,
        `⚠️ No space found for <b>$${symbol}</b> in your wallet.\n\nSpaces you can post in: ${available}\n\nExample: <code>/post $${postable[0].symbol} your message</code>`,
        { parseMode: 'HTML', replyToMessageId: messageId }
      );
      return;
    }
  }

  // Multiple spaces, no symbol specified — ask them to pick
  if (!target) {
    const lines = postable
      .slice(0, 10)
      .map((c) => `• <code>/post $${c.symbol} ${truncate(content, 30)}</code>`)
      .join('\n');
    await sendTelegramMessage(
      chatId,
      [
        `You're in <b>${postable.length} spaces</b>. Which one?`,
        '',
        lines,
      ].join('\n'),
      { parseMode: 'HTML', replyToMessageId: messageId }
    );
    return;
  }

  // Post to the resolved community
  const trimmed = content.slice(0, 2000);
  const author = await resolveAuthorProfile(wallet);
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
      client: 'telegram',
      trigger: 'manual',
      viaAgent: false,
      externalRef: `telegram:${telegramUsername || chatId}`,
    },
  };

  const posts = await getPosts(target.tokenAddress);
  posts.push(newPost);
  await setPostsForToken(target.tokenAddress, posts);
  await updateCommunityCounts(target.tokenAddress, posts);

  await sendTelegramMessage(
    chatId,
    `✅ <b>Posted to $${target.symbol}!</b>\n\n"${truncate(trimmed, 120)}"\n\n${communityUrl(target.tokenAddress)}`,
    { parseMode: 'HTML', replyToMessageId: messageId }
  );
}

async function handleHelp(chatId: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    [
      '<b>Bankr Space Bot — Commands</b>',
      '',
      '/link — connect your wallet',
      '/unlink — remove wallet',
      '/spaces — list spaces you can post in',
      '/post $SYMBOL &lt;text&gt; — post to a specific space',
      '  e.g. <code>/post $SPACE GM everyone!</code>',
      '/balance — check $Space balance',
      '/help — this message',
    ].join('\n'),
    { parseMode: 'HTML' }
  );
}

export async function POST(req: Request) {
  if (!validateTelegramWebhookSecret(req)) {
    console.error('[telegram] webhook rejected — TELEGRAM_WEBHOOK_SECRET mismatch');
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

  try {
    // Commands that don't need a linked wallet
    if (command === 'start') {
      if (args.startsWith('wl_')) {
        await handleWebLinkStart(chatId, telegramId, telegramUsername, args.slice(3));
      } else {
        await handleStart(chatId, botUsername);
      }
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
  } catch (err) {
    console.error('[telegram] command failed', { command, err });
    try {
      await sendTelegramMessage(
        chatId,
        'Something went wrong handling that command. Try again in a moment.',
        { replyToMessageId: messageId }
      );
    } catch {
      // ignore secondary failure
    }
  }

  return NextResponse.json({ ok: true });
}
