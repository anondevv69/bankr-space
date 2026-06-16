/**
 * POST /api/telegram/webhook
 * Receives all updates from Telegram and dispatches bot commands.
 *
 * Supported commands:
 *   /start        — welcome + link prompt
 *   /link         — generate a link code and send the link URL
 *   /unlink       — remove wallet↔Telegram link
 *   /create       — create a bankr.space for a Bankr token
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
import { createCommunityFromLaunch } from '@/lib/create-community-from-launch';
import { checkParticipation } from '@/lib/participation';
import { resolveAuthorProfile } from '@/lib/profiles';
import { resolveCommunityLink } from '@/lib/resolve-community';
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

function isGroupChat(chatType: string | undefined): boolean {
  return chatType === 'group' || chatType === 'supergroup';
}

function groupCommandHint(_botUsername: string): string {
  return 'In this group: <code>/post $SYMBOL your message</code> — e.g. <code>/post $SPACE yerrr</code>';
}

async function handleGroupWelcome(chatId: number, botUsername: string, title?: string): Promise<void> {
  const name = title ? `<b>${title}</b>` : 'this group';
  await sendTelegramMessage(
    chatId,
    [
      `👋 Bankr Space bot added to ${name}!`,
      '',
      'Post to bankr.space from here:',
      '<code>/post $SPACE your message</code>',
      '',
      'Each person links once via DM →',
      `<a href="https://t.me/${botUsername}?start=link">@${botUsername}</a> → /link`,
      '',
      '<i>Tip: send /help anytime for this list.</i>',
    ].join('\n'),
    { parseMode: 'HTML', disableWebPagePreview: false }
  );
}

async function handleStart(chatId: number, botUsername: string, inGroup: boolean): Promise<void> {
  const groupNote = inGroup
    ? [
        '',
        '<b>Post here:</b> <code>/post $SPACE your message</code>',
        `First time? DM <a href="https://t.me/${botUsername}?start=link">@${botUsername}</a> → /link`,
      ]
    : [];

  await sendTelegramMessage(
    chatId,
    [
      '👋 Welcome to <b>Bankr Space</b>!',
      '',
      'Post to your community space and manage $Space from Telegram.',
      '',
      '<b>First, link your wallet:</b>',
      inGroup ? `→ DM me @${botUsername} and send /link` : '→ /link',
      '',
      '<b>Then post:</b>',
      `<code>/post $SYMBOL your message</code>`,
      '',
      '<b>Create a space:</b>',
      '<code>/create $SYMBOL</code>',
      '',
      '/spaces — see your spaces',
      '/balance — check $Space',
      '/help — all commands',
      ...groupNote,
    ].join('\n'),
    { parseMode: 'HTML' }
  );
}

async function handleLink(
  chatId: number,
  telegramId: string,
  telegramUsername: string | null,
  botUsername: string,
  inGroup: boolean
): Promise<void> {
  if (inGroup) {
    await sendTelegramMessage(
      chatId,
      [
        '🔒 <b>Link your wallet in a private chat</b>',
        '',
        'For security, wallet linking is DM-only.',
        `Open <a href="https://t.me/${botUsername}?start=link">@${botUsername}</a> and send <code>/link</code>.`,
      ].join('\n'),
      { parseMode: 'HTML', disableWebPagePreview: false }
    );
    return;
  }

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
  // Match leading $SYMBOL (case-insensitive ticker)
  const match = args.match(/^\$([A-Za-z0-9_]+)\s+([\s\S]+)$/i);
  if (match) {
    return { symbol: match[1].toUpperCase(), content: match[2].trim() };
  }
  return { symbol: null, content: args.trim() };
}

/** Parse `/create $SYMBOL`, `/create 0x…`, or `/create $SYMBOL optional description`. */
function parseCreateArgs(args: string): { query: string; description: string } {
  const trimmed = args.trim();
  if (!trimmed) return { query: '', description: '' };

  const addrMatch = trimmed.match(/^(0x[a-fA-F0-9]{40})(?:\s+([\s\S]+))?$/i);
  if (addrMatch) {
    return { query: addrMatch[1], description: (addrMatch[2] || '').trim() };
  }

  const symbolMatch = trimmed.match(/^(\$?[A-Za-z0-9_]+)(?:\s+([\s\S]+))?$/);
  if (symbolMatch) {
    return {
      query: symbolMatch[1].replace(/^\$/, ''),
      description: (symbolMatch[2] || '').trim(),
    };
  }

  return { query: trimmed.replace(/^\$/, ''), description: '' };
}

async function handleCreate(
  chatId: number,
  wallet: string,
  rawArgs: string,
  messageId: number
): Promise<void> {
  const { query, description } = parseCreateArgs(rawArgs);

  if (!query) {
    await sendTelegramMessage(
      chatId,
      [
        '🏗️ <b>Create a space</b>',
        '',
        'Start a bankr.space for any Bankr-launched token:',
        '<code>/create $SYMBOL</code>',
        '<code>/create 0x…contract</code>',
        '',
        'Examples:',
        '<code>/create $SPACE</code>',
        '<code>/create $TMP A holder community for TMP</code>',
        '',
        'Token must be deployed via Bankr. Fee recipients are auto-verified.',
      ].join('\n'),
      { parseMode: 'HTML', replyToMessageId: messageId }
    );
    return;
  }

  const resolved = await resolveCommunityLink(query);

  if (resolved.communityExists && resolved.communityLink) {
    await sendTelegramMessage(
      chatId,
      [
        `ℹ️ <b>$${resolved.symbol}</b> already has a space.`,
        '',
        resolved.communityLink,
      ].join('\n'),
      { parseMode: 'HTML', replyToMessageId: messageId, disableWebPagePreview: false }
    );
    return;
  }

  if (!resolved.tokenAddress || !resolved.suggestCreateCommunity) {
    await sendTelegramMessage(
      chatId,
      resolved.error
        ? `⚠️ ${resolved.error}`
        : `⚠️ No Bankr token found for <b>${query}</b>. Try a contract address or search on bankr.space.`,
      { parseMode: 'HTML', replyToMessageId: messageId }
    );
    return;
  }

  try {
    const result = await createCommunityFromLaunch({
      tokenAddress: resolved.tokenAddress,
      founderWallet: wallet,
      description: description || undefined,
    });

    const { community, created, links } = result;
    const verifiedNote = community.verified
      ? '✅ Auto-verified (you are the fee recipient).'
      : 'Unverified — fee recipient can verify on bankr.space.';

    if (!created) {
      await sendTelegramMessage(
        chatId,
        [
          `ℹ️ <b>$${community.symbol}</b> space already exists.`,
          '',
          links.communityPage,
        ].join('\n'),
        { parseMode: 'HTML', replyToMessageId: messageId, disableWebPagePreview: false }
      );
      return;
    }

    await sendTelegramMessage(
      chatId,
      [
        `🎉 <b>Space created for $${community.symbol}!</b>`,
        '',
        community.name,
        verifiedNote,
        '',
        `Post: <code>/post $${community.symbol} GM everyone!</code>`,
        links.communityPage,
      ].join('\n'),
      { parseMode: 'HTML', replyToMessageId: messageId, disableWebPagePreview: false }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create space';
    await sendTelegramMessage(chatId, `⚠️ ${message}`, { replyToMessageId: messageId });
  }
}

async function handlePost(
  chatId: number,
  wallet: string,
  rawArgs: string,
  messageId: number,
  telegramUsername: string | null,
  botUsername: string,
  inGroup: boolean
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
    inGroup
      ? [
          `✅ <b>Posted to $${target.symbol}!</b>`,
          `"${truncate(trimmed, 120)}"`,
          '',
          `Anyone can post: <code>/post $${target.symbol} your message</code>`,
          `New here? DM <a href="https://t.me/${botUsername}?start=link">@${botUsername}</a> → /link once.`,
          communityUrl(target.tokenAddress),
        ].join('\n')
      : `✅ <b>Posted to $${target.symbol}!</b>\n\n"${truncate(trimmed, 120)}"\n\n${communityUrl(target.tokenAddress)}`,
    { parseMode: 'HTML', replyToMessageId: messageId, disableWebPagePreview: false }
  );
}

async function handleHelp(
  chatId: number,
  botUsername: string,
  inGroup: boolean,
  messageId?: number
): Promise<void> {
  const site = getSiteUrl();
  const lines = [
    '<b>Bankr Space Bot</b>',
    'Post to bankr.space from Telegram.',
    '',
    '<b>── Getting started ──</b>',
    `1. DM <a href="https://t.me/${botUsername}?start=link">@${botUsername}</a> → <code>/link</code>`,
    '2. Sign with MetaMask on Base (one time)',
    '3. Post in any group or DM',
    '',
    '<b>── Commands ──</b>',
    '<code>/create $SYMBOL</code> — create a space for a Bankr token',
    '  e.g. <code>/create $SPACE</code>',
    '<code>/post $SYMBOL &lt;message&gt;</code> — post to a space',
    '  e.g. <code>/post $SPACE yerrr</code>',
    '<code>/spaces</code> — spaces you can post in (need token)',
    '<code>/balance</code> — your $Space balance',
    '<code>/link</code> — connect wallet <i>(DM only)</i>',
    '<code>/unlink</code> — disconnect wallet',
    '<code>/start</code> — welcome message',
    '<code>/help</code> — this list',
  ];

  if (inGroup) {
    lines.push(
      '',
      '<b>── In this group ──</b>',
      groupCommandHint(botUsername),
      'Anyone with a linked wallet + token can post.',
      `New? DM @${botUsername} → /link first.`
    );
  }

  lines.push('', `<a href="${site}">bankr.space</a> — browse all spaces`);

  await sendTelegramMessage(chatId, lines.join('\n'), {
    parseMode: 'HTML',
    disableWebPagePreview: false,
    replyToMessageId: messageId,
  });
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

  const botUsername = getTelegramBotUsername();

  // Bot added to a group — post welcome with /post instructions
  const member = update.my_chat_member;
  const wasAbsent =
    member?.old_chat_member?.status === 'left' ||
    member?.old_chat_member?.status === 'kicked';
  const nowPresent =
    member?.new_chat_member?.status === 'member' ||
    member?.new_chat_member?.status === 'administrator';
  if (
    member?.new_chat_member?.user?.is_bot &&
    isGroupChat(member.chat.type) &&
    wasAbsent &&
    nowPresent
  ) {
    try {
      await handleGroupWelcome(member.chat.id, botUsername, member.chat.title);
    } catch (err) {
      console.error('[telegram] group welcome failed', err);
    }
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text || !message.from) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const inGroup = isGroupChat(chatType);
  const telegramId = String(message.from.id);
  const telegramUsername = message.from.username || null;
  const text = message.text.trim();
  const messageId = message.message_id;

  const parsed = parseTelegramCommand(text, botUsername);

  // Not a command — ignore (could support free-form posting later)
  if (!parsed) {
    return NextResponse.json({ ok: true });
  }

  const { command, args } = parsed;

  try {
    // Commands that don't need a linked wallet
    if (command === 'start') {
      if (args.startsWith('wl_')) {
        if (inGroup) {
          await sendTelegramMessage(
            chatId,
            `Open <a href="https://t.me/${botUsername}?start=${encodeURIComponent(args)}">@${botUsername}</a> in a private chat to finish linking.`,
            { parseMode: 'HTML' }
          );
        } else {
          await handleWebLinkStart(chatId, telegramId, telegramUsername, args.slice(3));
        }
      } else if (args === 'link' && inGroup) {
        await sendTelegramMessage(
          chatId,
          `Send <code>/link</code> in a <a href="https://t.me/${botUsername}">private chat</a> with me to link your wallet.`,
          { parseMode: 'HTML' }
        );
      } else if (args === 'link') {
        await handleLink(chatId, telegramId, telegramUsername, botUsername, false);
      } else {
        await handleStart(chatId, botUsername, inGroup);
      }
      return NextResponse.json({ ok: true });
    }
    if (command === 'help') {
      await handleHelp(chatId, botUsername, inGroup, messageId);
      return NextResponse.json({ ok: true });
    }
    if (command === 'link') {
      await handleLink(chatId, telegramId, telegramUsername, botUsername, inGroup);
      return NextResponse.json({ ok: true });
    }

    // Commands that require a linked wallet
    const link = await getTelegramLinkByTgId(telegramId);

    if (command === 'unlink') {
      await handleUnlink(chatId, telegramId);
      return NextResponse.json({ ok: true });
    }

    if (!link) {
      const linkHint = inGroup
        ? [
            'Link your wallet once to post here:',
            `<code>/post $SPACE your message</code> after you DM <a href="https://t.me/${botUsername}?start=link">@${botUsername}</a> → /link`,
          ].join('\n')
        : 'No wallet linked yet. Use /link to connect your wallet first.';
      await sendTelegramMessage(chatId, linkHint, {
        parseMode: inGroup ? 'HTML' : undefined,
        replyToMessageId: messageId,
      });
      return NextResponse.json({ ok: true });
    }

    switch (command) {
      case 'balance':
        await handleBalance(chatId, link.wallet);
        break;
      case 'spaces':
        await handleSpaces(chatId, link.wallet);
        break;
      case 'create':
        await handleCreate(chatId, link.wallet, args, messageId);
        break;
      case 'post':
        await handlePost(
          chatId,
          link.wallet,
          args,
          messageId,
          telegramUsername,
          botUsername,
          inGroup
        );
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
