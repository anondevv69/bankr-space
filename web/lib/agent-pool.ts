import type { AgentPoolCampaign, AgentPoolSkillId, AgentPoolState } from './types';

export const AGENT_POOL_SKILL_IDS: AgentPoolSkillId[] = ['0xwork', 'qrcoin'];

export const AGENT_POOL_SKILL_META: Record<
  AgentPoolSkillId,
  { label: string; defaultGoalUsd: number; description: string }
> = {
  qrcoin: {
    label: 'QRCoin — QR listing for this space',
    defaultGoalUsd: 50,
    description: 'Agent places a qrcoin.fun bid with your space URL when funded.',
  },
  '0xwork': {
    label: '0xWork — bagwork & bounties',
    defaultGoalUsd: 200,
    description: 'Agent posts paid tasks (tweets, art, banner) on 0xWork when funded.',
  },
  poidh: {
    label: 'POIDH — open bounties (legacy)',
    defaultGoalUsd: 50,
    description: 'Legacy agent-pool path — use the Bounties tab for POIDH open bounties.',
  },
};

export const WORK_BRIEF_MAX_LENGTH = 4000;

/** Example lines for work brief (one human task per line). */
export const WORK_BRIEF_PLACEHOLDER = `Share $SYMBOL on X with screenshot — $5 — Social
Take a photo at the space banner URL — $10 — Photo
Quote-tweet the community link with 2 sentences — $8 — Social`;

export const POIDH_WORK_BRIEF_PLACEHOLDER = `Share $SYMBOL on X with screenshot — $5
Take a photo holding $SYMBOL merch — $10
Visit bankr.space/community and screenshot the feed — $8`;

export function normalizeWorkBrief(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim().slice(0, WORK_BRIEF_MAX_LENGTH);
  return trimmed || null;
}

export const DEFAULT_AGENT_POOL_CAMPAIGNS: AgentPoolCampaign[] = AGENT_POOL_SKILL_IDS.map(
  (skillId) => ({
    skillId,
    label: AGENT_POOL_SKILL_META[skillId].label,
    goalUsd: AGENT_POOL_SKILL_META[skillId].defaultGoalUsd,
    raisedUsd: 0,
    enabled: false,
    fundedAt: null,
    executedAt: null,
    executionNote: null,
    executionTxHash: null,
    oxworkTaskId: null,
    oxworkTaskStatus: null,
    poidhBountyId: null,
    jobLinkedAt: null,
    bankrAgentJobId: null,
    workBrief: null,
    communityLed: false,
    proposedBy: null,
    proposedAt: null,
  })
);

function clampGoal(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.round(n * 100) / 100, 1_000_000);
}

function clampRaised(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function mergeCampaigns(raw: AgentPoolState | null | undefined): AgentPoolCampaign[] {
  const bySkill = new Map<AgentPoolSkillId, AgentPoolCampaign>();
  for (const defaults of DEFAULT_AGENT_POOL_CAMPAIGNS) {
    bySkill.set(defaults.skillId, { ...defaults });
  }
  if (raw && Array.isArray(raw.campaigns)) {
    for (const item of raw.campaigns) {
      if (!item || typeof item !== 'object') continue;
      const skillId = String((item as AgentPoolCampaign).skillId || '') as AgentPoolSkillId;
      if (!AGENT_POOL_SKILL_IDS.includes(skillId)) continue;
      const current = bySkill.get(skillId)!;
      bySkill.set(skillId, {
        skillId,
        label: String((item as AgentPoolCampaign).label || current.label).slice(0, 120),
        goalUsd: clampGoal((item as AgentPoolCampaign).goalUsd ?? current.goalUsd),
        raisedUsd: clampRaised((item as AgentPoolCampaign).raisedUsd ?? 0),
        enabled: Boolean((item as AgentPoolCampaign).enabled),
        fundedAt:
          (item as AgentPoolCampaign).fundedAt != null
            ? Number((item as AgentPoolCampaign).fundedAt)
            : null,
        executedAt:
          (item as AgentPoolCampaign).executedAt != null
            ? Number((item as AgentPoolCampaign).executedAt)
            : null,
        executionNote:
          (item as AgentPoolCampaign).executionNote != null
            ? String((item as AgentPoolCampaign).executionNote).slice(0, 500)
            : null,
        executionTxHash:
          (item as AgentPoolCampaign).executionTxHash != null
            ? String((item as AgentPoolCampaign).executionTxHash).slice(0, 66)
            : null,
        oxworkTaskId:
          (item as AgentPoolCampaign).oxworkTaskId != null
            ? Number((item as AgentPoolCampaign).oxworkTaskId)
            : null,
        oxworkTaskStatus:
          (item as AgentPoolCampaign).oxworkTaskStatus != null
            ? String((item as AgentPoolCampaign).oxworkTaskStatus).slice(0, 40)
            : null,
        poidhBountyId:
          (item as AgentPoolCampaign).poidhBountyId != null
            ? Number((item as AgentPoolCampaign).poidhBountyId)
            : null,
        jobLinkedAt:
          (item as AgentPoolCampaign).jobLinkedAt != null
            ? Number((item as AgentPoolCampaign).jobLinkedAt)
            : null,
        bankrAgentJobId:
          (item as AgentPoolCampaign).bankrAgentJobId != null
            ? String((item as AgentPoolCampaign).bankrAgentJobId).slice(0, 80)
            : null,
        workBrief:
          skillId === '0xwork' || skillId === 'poidh'
            ? normalizeWorkBrief((item as AgentPoolCampaign).workBrief)
            : null,
        communityLed: Boolean((item as AgentPoolCampaign).communityLed),
        proposedBy:
          (item as AgentPoolCampaign).proposedBy != null
            ? String((item as AgentPoolCampaign).proposedBy).toLowerCase()
            : null,
        proposedAt:
          (item as AgentPoolCampaign).proposedAt != null
            ? Number((item as AgentPoolCampaign).proposedAt)
            : null,
      });
    }
  }
  return AGENT_POOL_SKILL_IDS.map((id) => bySkill.get(id)!);
}

export function normalizeAgentPool(input: unknown, options?: { fromSave?: boolean }): AgentPoolState {
  const raw = input && typeof input === 'object' ? (input as AgentPoolState) : null;
  const campaigns = mergeCampaigns(raw);

  if (options?.fromSave) {
    return { optedIn: campaigns.some((c) => c.enabled), campaigns };
  }

  return {
    optedIn: Boolean(raw?.optedIn),
    campaigns,
  };
}

export function readStoredAgentPool(input: unknown): AgentPoolState {
  return normalizeAgentPool(input);
}

export function isAgentPoolCampaignFunded(campaign: AgentPoolCampaign): boolean {
  return campaign.goalUsd > 0 && campaign.raisedUsd >= campaign.goalUsd;
}

export function openAgentPoolCampaigns(state: AgentPoolState | undefined | null): AgentPoolCampaign[] {
  if (!state?.optedIn) return [];
  return state.campaigns.filter(
    (c) => c.enabled && !isAgentPoolCampaignFunded(c) && (c.skillId === '0xwork' || c.skillId === 'qrcoin')
  );
}

export function matchedAgentPoolCampaigns(
  state: AgentPoolState | undefined | null
): AgentPoolCampaign[] {
  if (!state?.optedIn) return [];
  return state.campaigns.filter(
    (c) => c.enabled && isAgentPoolCampaignFunded(c) && !c.executedAt
  );
}

export function fundedAgentPoolCampaigns(
  state: AgentPoolState | undefined | null
): AgentPoolCampaign[] {
  if (!state?.optedIn) return [];
  return state.campaigns.filter((c) => c.enabled && isAgentPoolCampaignFunded(c));
}

export function completedAgentPoolCampaigns(
  state: AgentPoolState | undefined | null
): AgentPoolCampaign[] {
  if (!state?.optedIn) return [];
  return state.campaigns.filter((c) => c.enabled && Boolean(c.executedAt));
}

export function hasPublicAgentPool(state: AgentPoolState | undefined | null): boolean {
  return openAgentPoolCampaigns(state).length > 0;
}

export function hasAgentPoolHistory(state: AgentPoolState | undefined | null): boolean {
  if (!state?.optedIn) return false;
  return state.campaigns.some((c) => c.enabled && c.raisedUsd > 0);
}

/** Agent pool goals that met target or finished execution — for Fundraisers tab history. */
export function completedAgentPoolCampaignsForTab(
  state: AgentPoolState | undefined | null
): AgentPoolCampaign[] {
  if (!state?.optedIn) return [];
  return state.campaigns.filter(
    (c) =>
      AGENT_POOL_SKILL_IDS.includes(c.skillId) &&
      c.raisedUsd > 0 &&
      (isAgentPoolCampaignFunded(c) || Boolean(c.executedAt))
  );
}

export function agentPoolCampaignProgress(campaign: AgentPoolCampaign): number {
  if (campaign.goalUsd <= 0) return 0;
  return Math.min(100, (campaign.raisedUsd / campaign.goalUsd) * 100);
}

export function creditAgentPoolUsd(
  state: AgentPoolState,
  skillId: AgentPoolSkillId,
  amountUsd: number
): AgentPoolState {
  const amount = clampRaised(amountUsd);
  if (amount <= 0) return state;
  const now = Date.now();
  return {
    ...state,
    optedIn: true,
    campaigns: state.campaigns.map((c) => {
      if (c.skillId !== skillId) return c;
      const raisedUsd = clampRaised(c.raisedUsd + amount);
      const wasFunded = isAgentPoolCampaignFunded(c);
      const nowFunded = c.goalUsd > 0 && raisedUsd >= c.goalUsd;
      return {
        ...c,
        raisedUsd,
        fundedAt: !wasFunded && nowFunded ? now : c.fundedAt ?? null,
      };
    }),
  };
}

/** x402 campaign query param for agent pool credits (distinct from beneficiary campaigns). */
export function agentPoolX402CampaignId(skillId: AgentPoolSkillId): string {
  return `agent-${skillId}`;
}

/** Holder proposes a community agent goal — enables Lane B campaign without deployer edit. */
export function applyCommunityAgentProposal(
  state: AgentPoolState | undefined | null,
  input: {
    skillId: AgentPoolSkillId;
    goalUsd: number;
    workBrief?: string | null;
    label?: string | null;
    proposedBy: string;
  }
): AgentPoolState {
  const pool = readStoredAgentPool(state);
  const proposer = input.proposedBy.trim().toLowerCase();
  const now = Date.now();

  return {
    optedIn: true,
    campaigns: pool.campaigns.map((c) => {
      if (c.skillId !== input.skillId) return c;
      return {
        ...c,
        enabled: true,
        goalUsd: clampGoal(input.goalUsd),
        label: String(input.label || c.label).slice(0, 120),
        workBrief:
          input.skillId === '0xwork' || input.skillId === 'poidh'
            ? normalizeWorkBrief(input.workBrief ?? c.workBrief)
            : null,
        communityLed: true,
        proposedBy: proposer,
        proposedAt: now,
      };
    }),
  };
}

export function parseAgentPoolX402CampaignId(
  campaignId: string
): AgentPoolSkillId | null {
  const id = campaignId.trim().toLowerCase();
  if (!id.startsWith('agent-')) return null;
  const skillId = id.slice('agent-'.length) as AgentPoolSkillId;
  return AGENT_POOL_SKILL_IDS.includes(skillId) ? skillId : null;
}
