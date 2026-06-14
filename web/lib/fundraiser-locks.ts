import type {
  AgentPoolCampaign,
  AgentPoolSkillId,
  AgentPoolState,
  FundraisingCampaign,
  FundraisingState,
} from './types';
import { isBeneficiaryCampaignId, isCampaignFunded, readStoredFundraising } from './fundraising';
import {
  isAgentPoolCampaignFunded,
  openAgentPoolCampaigns,
  readStoredAgentPool,
} from './agent-pool';

export function isGoalFunded(raisedUsd: number, goalUsd: number): boolean {
  return goalUsd > 0 && raisedUsd >= goalUsd;
}

/** Active fundraiser with contributions still below goal — cannot be closed until met. */
export function isFundraiserLocked(
  raisedUsd: number,
  goalUsd: number,
  enabled: boolean
): boolean {
  if (!enabled) return false;
  if (isGoalFunded(raisedUsd, goalUsd)) return false;
  return raisedUsd > 0;
}

export function isBeneficiaryCampaignLocked(campaign: FundraisingCampaign): boolean {
  return isFundraiserLocked(campaign.raisedUsd, campaign.goalUsd, campaign.enabled);
}

export function isAgentPoolCampaignLocked(campaign: AgentPoolCampaign): boolean {
  return isFundraiserLocked(campaign.raisedUsd, campaign.goalUsd, campaign.enabled);
}

export type FundraiserSaveResult =
  | { ok: true; campaigns: FundraisingCampaign[] }
  | { ok: false; error: string; status: number };

function clampGoal(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.round(n * 100) / 100, 1_000_000);
}

function isNewCustomCampaignId(id: string): boolean {
  return id === 'custom' || /^custom-[a-z0-9-]+$/i.test(id);
}

export function applyBeneficiaryFundraisingSave(
  stored: FundraisingState | undefined | null,
  incomingCampaigns: FundraisingCampaign[]
): FundraiserSaveResult {
  const prev = readStoredFundraising(stored);
  const campaigns: FundraisingCampaign[] = [];

  for (const inc of incomingCampaigns) {
    const id = String(inc.id || '').trim();
    if (!isBeneficiaryCampaignId(id)) continue;

    const was = prev.campaigns.find((c) => c.id === id);
    if (!was) {
      if (!isNewCustomCampaignId(id)) continue;
      campaigns.push({
        id,
        label: String(inc.label || 'Community goal').slice(0, 80),
        goalUsd: clampGoal(inc.goalUsd, 500),
        raisedUsd: 0,
        enabled: Boolean(inc.enabled),
      });
      continue;
    }

    let enabled = Boolean(inc.enabled);
    const goalUsd = Number(inc.goalUsd);
    const label = String(inc.label || was.label).slice(0, 80);
    let raisedUsd = was.raisedUsd;

    // Re-open after a completed goal was closed → fresh fundraiser (same slot, $0 raised).
    if (enabled && !was.enabled && isGoalFunded(was.raisedUsd, was.goalUsd)) {
      raisedUsd = 0;
    }

    if (isFundraiserLocked(was.raisedUsd, was.goalUsd, was.enabled)) {
      if (!enabled) {
        return {
          ok: false,
          error: `Cannot close "${was.label}" — $${was.raisedUsd.toLocaleString()} USDC already contributed. Finish the goal or wait until it is met.`,
          status: 400,
        };
      }
      enabled = true;
      if (!Number.isFinite(goalUsd) || goalUsd < was.raisedUsd) {
        return {
          ok: false,
          error: `Goal for "${was.label}" cannot be below $${was.raisedUsd.toLocaleString()} already raised.`,
          status: 400,
        };
      }
    }

    campaigns.push({
      ...was,
      enabled,
      goalUsd: Number.isFinite(goalUsd) && goalUsd >= 1 ? goalUsd : was.goalUsd,
      label,
      raisedUsd,
    });
  }

  return { ok: true, campaigns };
}

export type AgentPoolSaveResult =
  | { ok: true; campaigns: AgentPoolCampaign[] }
  | { ok: false; error: string; status: number };

export function applyAgentPoolAdminSave(
  stored: AgentPoolState | undefined | null,
  incomingCampaigns: AgentPoolCampaign[]
): AgentPoolSaveResult {
  const prev = readStoredAgentPool(stored);
  const campaigns: AgentPoolCampaign[] = [];

  for (const inc of incomingCampaigns) {
    const was = prev.campaigns.find((c) => c.skillId === inc.skillId);
    if (!was) continue;

    let enabled = Boolean(inc.enabled);
    const goalUsd = Number(inc.goalUsd);
    const raisedUsd = was.raisedUsd;

    if (isFundraiserLocked(was.raisedUsd, was.goalUsd, was.enabled)) {
      if (!enabled) {
        return {
          ok: false,
          error: `Cannot close "${was.label}" — $${was.raisedUsd.toLocaleString()} USDC already contributed to the community agent pool.`,
          status: 400,
        };
      }
      enabled = true;
      if (!Number.isFinite(goalUsd) || goalUsd < was.raisedUsd) {
        return {
          ok: false,
          error: `Goal cannot be below $${was.raisedUsd.toLocaleString()} already raised.`,
          status: 400,
        };
      }
    }

    campaigns.push({
      ...was,
      ...inc,
      enabled,
      goalUsd: Number.isFinite(goalUsd) && goalUsd >= 1 ? goalUsd : was.goalUsd,
      raisedUsd,
      workBrief: inc.skillId === '0xwork' || inc.skillId === 'poidh' ? inc.workBrief : was.workBrief,
    });
  }

  const open = campaigns.filter((c) => c.enabled && !isAgentPoolCampaignFunded(c));
  if (open.length > 1) {
    return {
      ok: false,
      error:
        'Only one community agent goal can be open at a time. Complete or close the other first (goals with contributions cannot be closed).',
      status: 400,
    };
  }

  return { ok: true, campaigns };
}

/** Block starting a second open community agent goal. */
export function assertCanOpenAgentPoolGoal(
  pool: AgentPoolState | undefined | null,
  skillId: AgentPoolSkillId
): string | null {
  const stored = readStoredAgentPool(pool);
  const open = openAgentPoolCampaigns(stored);
  const other = open.filter((c) => c.skillId !== skillId);
  if (other.length > 0) {
    const active = other[0];
    return `Only one community agent goal can be open at a time. "${active.label}" is still active ($${active.raisedUsd.toLocaleString()} / $${active.goalUsd.toLocaleString()}).`;
  }
  return null;
}

/** @deprecated Multiple beneficiary fundraisers may be open at once. */
export function assertCanOpenBeneficiaryCampaign(
  _stored: FundraisingState | undefined | null,
  _campaignId: string,
  _enabling: boolean
): string | null {
  return null;
}
