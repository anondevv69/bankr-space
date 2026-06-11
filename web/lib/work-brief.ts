export type ParsedWorkBriefLine = {
  description: string;
  bountyUsd: number;
  category: string;
};

/** Parse `Share $SYMBOL on X — $5 — Social` style lines. */
export function parseWorkBriefLine(line: string): ParsedWorkBriefLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s*[—–-]\s*/);
  if (parts.length >= 3) {
    const bountyPart = parts[parts.length - 2].trim();
    const category = parts[parts.length - 1].trim();
    const description = parts.slice(0, -2).join(' — ').trim();
    const bountyMatch = bountyPart.match(/^\$?(\d+(?:\.\d+)?)/);
    const bountyUsd = bountyMatch ? Number(bountyMatch[1]) : NaN;
    if (description && Number.isFinite(bountyUsd) && bountyUsd > 0 && category) {
      return { description, bountyUsd, category };
    }
  }

  return null;
}

export function parseWorkBrief(text: string | null | undefined): ParsedWorkBriefLine[] {
  if (!text?.trim()) return [];
  return text
    .split('\n')
    .map(parseWorkBriefLine)
    .filter((line): line is ParsedWorkBriefLine => line != null);
}

export function applySymbolToBrief(
  text: string,
  symbol: string,
  tokenAddress: string
): string {
  const sym = symbol.replace(/^\$/, '');
  const spaceUrl = `https://www.bankr.space/community/${tokenAddress.toLowerCase()}`;
  let out = text
    .replace(/\$SYMBOL/gi, `$${sym}`)
    .replace(/\$SPACE/gi, `$${sym}`)
    .replace(/\{symbol\}/gi, `$${sym}`);
  if (!out.includes(spaceUrl)) out = `${out} ${spaceUrl}`;
  return out;
}

export function buildOxWorkAgentPrompt(options: {
  symbol: string;
  tokenAddress: string;
  workBrief: string | null;
  goalUsd: number;
}): string {
  const lines = parseWorkBrief(options.workBrief || '');
  const sym = options.symbol.replace(/^\$/, '');
  const spaceUrl = `https://www.bankr.space/community/${options.tokenAddress.toLowerCase()}`;

  if (lines.length) {
    const tasks = lines
      .map((line) => {
        const desc = applySymbolToBrief(line.description, sym, options.tokenAddress);
        return `- ${desc} — $${line.bountyUsd} USDC — ${line.category}`;
      })
      .join('\n');

    return [
      'Use the 0xwork skill on the platform agent wallet.',
      `Post these 0xWork bounties for $${sym} (one task per line):`,
      tasks,
      `Space: ${spaceUrl}`,
      'Return each created task id and 0xwork.org link.',
    ].join('\n');
  }

  const bounty = Math.max(1, Math.round(options.goalUsd));
  return [
    'Use the 0xwork skill on the platform agent wallet.',
    `Post one 0xWork Social bounty: Share $${sym} on X with screenshot — $${bounty} USDC.`,
    `Space: ${spaceUrl}`,
    'Return the task id and 0xwork.org link.',
  ].join('\n');
}

export function buildQrcoinAgentPrompt(options: {
  symbol: string;
  tokenAddress: string;
}): string {
  const sym = options.symbol.replace(/^\$/, '');
  const spaceUrl = `https://www.bankr.space/community/${options.tokenAddress.toLowerCase()}`;
  return [
    'Use the qrcoin skill on the platform agent wallet.',
    `Place a QRCoin bid listing for $${sym} with URL ${spaceUrl}.`,
    'Return transaction hash and bid details.',
  ].join('\n');
}

/** Extract POIDH on-chain bounty id from agent output or poidh.xyz URLs. */
export function extractPoidhBountyId(text: string): number | null {
  const patterns = [
    /poidh\.xyz\/base\/bounty\/(\d+)/i,
    /poidh\.xyz\/arbitrum\/bounty\/(\d+)/i,
    /on-chain bounty\s*#?\s*(\d+)/i,
    /bountyId["']?\s*[:=]\s*(\d+)/i,
    /Bounty ID:\s*(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const raw = Number(match[1]);
      if (!Number.isFinite(raw) || raw <= 0) continue;
      return raw > 500 ? raw - 986 : raw;
    }
  }
  return null;
}

export function buildPoidhAgentPrompt(options: {
  symbol: string;
  tokenAddress: string;
  workBrief: string | null;
  goalUsd: number;
}): string {
  const lines = parseWorkBrief(options.workBrief || '');
  const sym = options.symbol.replace(/^\$/, '');
  const spaceUrl = `https://www.bankr.space/community/${options.tokenAddress.toLowerCase()}`;
  const skillUrl =
    'https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md';

  const ethHint = Math.max(0.001, Math.round(options.goalUsd) * 0.001);

  if (lines.length) {
    const tasks = lines
      .map((line) => {
        const desc = applySymbolToBrief(line.description, sym, options.tokenAddress);
        return `- ${desc} (bounty ~$${line.bountyUsd} worth of ETH, min 0.001 ETH on Base)`;
      })
      .join('\n');

    return [
      `Use the poidh-bounty skill (${skillUrl}) on Base chain.`,
      'Use createOpenBounty ONLY (not solo) — this is POIDH’s crowdfunded open bounty product.',
      'Open bounties let others add ETH on poidh.xyz later; contributors vote yes/no for 48h when you propose a winner.',
      'Only the bounty creator may submitClaimForVote / propose winner — workers submit claims, creator picks the best.',
      'Post one open bounty per line below.',
      tasks,
      `Space: ${spaceUrl}`,
      `Seed the open bounty with at least 0.001 ETH from the platform agent wallet (target ~${ethHint} ETH from the USDC pool).`,
      'Title = short task name. Description = full instructions + space URL + what proof to submit (photo, tweet link, etc.).',
      'Return each poidh.xyz/base/bounty/ URL, on-chain bounty id, and transaction hash.',
      'Guide: https://words.poidh.xyz/poidh-open-bounties-guide',
      'If wallet is a smart contract and create reverts, report ContractsCannotCreateBounties clearly.',
    ].join('\n');
  }

  const bountyUsd = Math.max(1, Math.round(options.goalUsd));
  return [
    `Use the poidh-bounty skill (${skillUrl}) on Base chain.`,
    'Use createOpenBounty ONLY (not solo) — POIDH open bounty with on-chain crowdfunding + contributor voting.',
    `Post one open bounty: Share $${sym} on X with screenshot (photo or tweet link as proof).`,
    `Title: Share $${sym} on X`,
    `Description must include: ${spaceUrl} and what proof to upload.`,
    `Seed amount: at least 0.001 ETH (~$${bountyUsd} USDC was raised — use equivalent ETH from agent wallet). Others can add funds on poidh.xyz after.`,
    'After workers submit claims, bounty creator proposes winner → 48h contributor vote → automatic payout.',
    'Return poidh.xyz/base/bounty/ URL, on-chain bounty id, and tx hash.',
    'Guide: https://words.poidh.xyz/poidh-open-bounties-guide',
  ].join('\n');
}

/** Extract 0xWork task id from Bankr agent job output. */
export function extractOxWorkTaskId(text: string): number | null {
  const patterns = [
    /0xwork\.org\/tasks\/(\d+)/i,
    /task\s*#?\s*(\d+)/i,
    /taskId["']?\s*[:=]\s*(\d+)/i,
    /"id"\s*:\s*(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const id = Number(match[1]);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }
  return null;
}

export function extractTxHash(text: string): string | null {
  const match = text.match(/0x[a-fA-F0-9]{64}/);
  return match?.[0] ?? null;
}
