/** POIDH open bounty model — https://words.poidh.xyz/poidh-open-bounties-guide */

export const POIDH_OPEN_BOUNTY_GUIDE_URL =
  'https://words.poidh.xyz/poidh-open-bounties-guide';

export const POIDH_OPEN_BOUNTY_STEPS = [
  {
    title: 'Community seeds the bounty',
    body: 'Holders fund the task here in USDC ($1 per click). When the goal is met, the Bankr agent creates an open bounty on poidh.xyz with ETH from the platform wallet.',
  },
  {
    title: 'Anyone can add funds (optional)',
    body: 'On the bounty page, use Add funds to grow the reward pool in ETH. Your share of the pool = your voting power if a winner is proposed.',
  },
  {
    title: 'Do the work & submit proof',
    body: 'Connect wallet on poidh.xyz, complete the task, and submit a photo or link as proof. No CLI required.',
  },
  {
    title: 'Creator proposes winner → 48h vote',
    body: 'The bounty creator proposes the best claim. Contributors vote yes/no for 48 hours (weighted by funds). If yes wins, the worker is paid from the pool automatically.',
  },
] as const;

export const POIDH_COMMUNITY_TASK_INTRO =
  'Open bounties on POIDH are crowdfunded outcome markets: pool ETH on-chain, verify proof together, pay automatically. Better for human tasks (photos, tweets, IRL) than agent-only marketplaces.';
