/** Copy for Edit space → Community agent panel (keep in sync with AGENT-COMMUNITY-POOL.md). */

export const PLATFORM_AGENT_DOES = [
  'Post fundraiser & community-pool milestone updates (max once per goal per day)',
  'Pin important agent posts',
  'Lane B: run POIDH / QRCoin / 0xWork after community pool is funded (x402 → agent wallet)',
  'Lane A: run skills after beneficiary fundraiser matched (fee recipient authorizes)',
  'Post skill results on the feed and 0xJobs tab',
] as const;

export const PLATFORM_AGENT_DOES_NOT = [
  'Enable beneficiary fundraisers — fee recipient only',
  'Receive Lane A x402 USDC — that goes to the fee recipient',
  'Change space profile, icon, or banner',
  'Delete posts or enforce blocked keywords (team does that)',
  'Generate images automatically',
] as const;

export const SPACE_MODERATION_NOTE =
  'Blocked keywords apply to holder posts immediately. Fee recipient, deployer (if allowed), trusted delegates, and the platform agent can still post.';

export const AGENT_POOL_NOTE =
  'Lane B — community goals. Holders propose what the agent should do; everyone funds via x402. USDC → platform agent wallet. Separate from beneficiary programs (fee recipient only).';

export const COMMUNITY_AGENT_LANE_NOTE =
  'The Bankr Space Agent works for holders — bagwork, QRCoin, milestones. Fee recipient fundraisers are for their own token programs.';

export const WORK_BRIEF_NOTE =
  'One task per line: description — $amount (optional category for 0xWork). $SYMBOL and the space URL are filled in automatically.';
