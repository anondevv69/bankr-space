import type { AgentPoolCampaign } from './types';
import { isAgentPoolCampaignFunded } from './agent-pool';
import { oxWorkTaskUrl } from './oxwork-api';
import { poidhBountyUrl } from './poidh-api';

/** Funded but no job / execution after this long → stuck. */
export const AGENT_POOL_STUCK_MS = 30 * 60 * 1000;

export type AgentPoolExecutionPhase =
  | 'open'
  | 'funded'
  | 'pending_job'
  | 'stuck'
  | 'job_linked'
  | 'executed';

export function agentPoolFundedSince(campaign: AgentPoolCampaign): number | null {
  if (campaign.fundedAt != null && Number.isFinite(campaign.fundedAt)) {
    return Number(campaign.fundedAt);
  }
  if (campaign.proposedAt != null && Number.isFinite(campaign.proposedAt)) {
    return Number(campaign.proposedAt);
  }
  return null;
}

export function agentPoolExecutionPhase(
  campaign: AgentPoolCampaign,
  now = Date.now()
): AgentPoolExecutionPhase {
  if (!campaign.enabled) return 'open';
  if (campaign.executedAt) return 'executed';
  if (!isAgentPoolCampaignFunded(campaign)) return 'open';

  if (campaign.oxworkTaskId != null && campaign.skillId === '0xwork' && !campaign.executedAt) {
    return 'job_linked';
  }

  if (campaign.poidhBountyId != null && campaign.skillId === 'poidh' && !campaign.executedAt) {
    return 'job_linked';
  }

  if (campaign.bankrAgentJobId?.trim()) {
    return 'pending_job';
  }

  const since = agentPoolFundedSince(campaign);
  if (since != null && now - since >= AGENT_POOL_STUCK_MS) {
    return 'stuck';
  }

  return 'funded';
}

export function agentPoolStatusLabel(
  phase: AgentPoolExecutionPhase,
  campaign?: AgentPoolCampaign
): string {
  const isPoidh = campaign?.skillId === 'poidh';
  switch (phase) {
    case 'open':
      return 'Open — accepting contributions';
    case 'funded':
      return 'Funded — awaiting agent';
    case 'pending_job':
      return isPoidh ? 'Agent working — posting POIDH bounty' : 'Agent working — posting job';
    case 'stuck':
      return 'Funded — agent delayed (check back soon)';
    case 'job_linked':
      return isPoidh ? 'POIDH bounty live — claim on poidh.xyz' : 'Job posted — open for workers';
    case 'executed':
      return 'Executed by agent';
    default:
      return 'Unknown';
  }
}

export function agentPoolStatusClass(phase: AgentPoolExecutionPhase): string {
  switch (phase) {
    case 'executed':
    case 'job_linked':
      return 'text-green-600 dark:text-green-400';
    case 'pending_job':
      return 'text-blue-600 dark:text-blue-400';
    case 'stuck':
      return 'text-red-600 dark:text-red-400';
    case 'funded':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-muted';
  }
}

export function agentPoolOxWorkUrl(campaign: AgentPoolCampaign): string | null {
  if (campaign.oxworkTaskId == null) return null;
  return oxWorkTaskUrl(campaign.oxworkTaskId);
}

export function agentPoolPoidhUrl(campaign: AgentPoolCampaign): string | null {
  if (campaign.poidhBountyId == null) return null;
  return poidhBountyUrl(campaign.poidhBountyId);
}

export type AgentPoolCampaignStatusView = AgentPoolCampaign & {
  phase: AgentPoolExecutionPhase;
  statusLabel: string;
  oxworkUrl: string | null;
  poidhUrl: string | null;
  fundedSince: number | null;
  waitingMs: number | null;
};

export function enrichAgentPoolCampaignStatus(
  campaign: AgentPoolCampaign,
  now = Date.now()
): AgentPoolCampaignStatusView {
  const phase = agentPoolExecutionPhase(campaign, now);
  const fundedSince = isAgentPoolCampaignFunded(campaign) ? agentPoolFundedSince(campaign) : null;
  return {
    ...campaign,
    phase,
    statusLabel: agentPoolStatusLabel(phase, campaign),
    oxworkUrl: agentPoolOxWorkUrl(campaign),
    poidhUrl: agentPoolPoidhUrl(campaign),
    fundedSince,
    waitingMs: fundedSince != null && !campaign.executedAt ? now - fundedSince : null,
  };
}
