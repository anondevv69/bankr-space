/** POIDH open bounty model — https://words.poidh.xyz/poidh-open-bounties-guide */

export const POIDH_OPEN_BOUNTY_GUIDE_URL =
  'https://words.poidh.xyz/poidh-open-bounties-guide';

export const POIDH_OPEN_BOUNTY_STEPS = [
  {
    title: 'Create a bounty in the Bounties tab',
    body: 'Any token holder describes the task (Dex profile, shoutout, listing, etc.). It opens on-chain automatically as an open bounty.',
  },
  {
    title: 'Add funds in ETH',
    body: 'Use Add funds right on the bounty card to grow the reward pool. Your share of the pool = your voting power when a winner is proposed.',
  },
  {
    title: 'Do the work & submit proof',
    body: 'Complete the task, then paste a proof link on the bounty card — tweet URL, screenshot/image link, or your bankr.space community page if you posted there.',
  },
  {
    title: 'Finalize claim',
    body: 'After you submit a claim, the issuer wallet pays out. If multiple people funded the bounty, contributors vote yes/no for 48 hours (weighted by funds). If only the issuer funded it, the claim is accepted immediately — no vote.',
  },
] as const;

export const POIDH_COMMUNITY_TASK_INTRO =
  'Open bounties are crowdfunded outcome markets: create a task in the Bounties tab, pool ETH on-chain here, verify proof together, pay automatically.';

/** Any public http(s) link — tweet, image, community page, etc. Stored on-chain as claim URI. */
export function isValidProofUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
