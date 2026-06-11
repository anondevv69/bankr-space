/** POIDH open bounty model — https://words.poidh.xyz/poidh-open-bounties-guide */

export const POIDH_OPEN_BOUNTY_GUIDE_URL =
  'https://words.poidh.xyz/poidh-open-bounties-guide';

export const POIDH_OPEN_BOUNTY_STEPS = [
  {
    title: 'Create a bounty in the Bounties tab',
    body: 'Any token holder describes the task (Dex profile, shoutout, listing, etc.). The agent opens it on poidh.xyz as an open bounty.',
  },
  {
    title: 'Add funds in ETH',
    body: 'On the bounty page, use Add funds to grow the reward pool. Your share of the pool = your voting power when a winner is proposed.',
  },
  {
    title: 'Do the work & post proof',
    body: 'Complete the task, post proof in the bankr.space community, then submit your community post URL on poidh.xyz.',
  },
  {
    title: 'Creator proposes winner → 48h vote',
    body: 'The bounty creator proposes the best claim. Contributors vote yes/no for 48 hours (weighted by funds). If yes wins, the worker is paid from the pool automatically.',
  },
] as const;

export const POIDH_COMMUNITY_TASK_INTRO =
  'Open bounties on POIDH are crowdfunded outcome markets: create a task in the Bounties tab, pool ETH on-chain, verify proof together, pay automatically.';
