import type { AgentPoolCampaign, AgentPoolState, Community } from './types';
import { mergeCommunityDefaults } from './community-posts';
import { normalizeAgentPool, readStoredAgentPool } from './agent-pool';
import { createCommunityPoidhBounty, normalizePoidhBounties } from './poidh-community-bounties';

function legacyPoidhCampaign(raw: AgentPoolState | null | undefined): AgentPoolCampaign | null {
  const item = raw?.campaigns?.find((c) => c?.skillId === 'poidh');
  return item && typeof item === 'object' ? (item as AgentPoolCampaign) : null;
}

function stripPoidhFromRawPool(raw: AgentPoolState | null | undefined): AgentPoolState {
  if (!raw?.campaigns?.length) {
    return normalizeAgentPool(raw, { fromSave: true });
  }
  const campaigns = raw.campaigns.filter((c) => c?.skillId !== 'poidh');
  return normalizeAgentPool({ ...raw, campaigns }, { fromSave: true });
}

/**
 * POIDH no longer uses Lane B x402. Move any open legacy agent-pool POIDH goal to poidhBounties
 * and remove it from the sidebar agent pool.
 */
export function migrateLegacyPoidhAgentPool(community: Community): {
  community: Community;
  changed: boolean;
} {
  const merged = mergeCommunityDefaults(community);
  const legacy = legacyPoidhCampaign(community.agentPool);
  if (!legacy) {
    return { community: merged, changed: false };
  }

  let poidhState = normalizePoidhBounties(merged.poidhBounties);
  let changed = false;

  const shouldMigrate =
    legacy.enabled &&
    (legacy.workBrief?.trim() || legacy.label?.trim()) &&
    !legacy.executedAt;

  if (shouldMigrate) {
    const brief = legacy.workBrief?.trim() || '';
    const titleFromBrief = brief.split('\n').find((line) => line.trim())?.trim();
    const title =
      (legacy.label &&
      !/^poidh/i.test(legacy.label) &&
      legacy.label.length > 8
        ? legacy.label
        : titleFromBrief || 'Community bounty'
      ).slice(0, 120);

    const already = poidhState.bounties.some((b) => {
      if (brief && b.description.includes(brief.slice(0, 48))) return true;
      return b.title.toLowerCase() === title.toLowerCase();
    });

    if (!already) {
      const bounty = createCommunityPoidhBounty({
        title,
        description: brief || title,
        symbol: merged.symbol,
        tokenAddress: merged.tokenAddress,
        requestedBy: legacy.proposedBy || 'legacy-migration',
      });
      poidhState = {
        ...poidhState,
        enabled: true,
        bounties: [...poidhState.bounties, bounty],
        spinUpAt: poidhState.spinUpAt ?? Date.now(),
      };
      changed = true;
    }
  }

  const cleanedPool = stripPoidhFromRawPool(community.agentPool);
  const currentPool = readStoredAgentPool(merged.agentPool);
  if (
    JSON.stringify(cleanedPool) !== JSON.stringify(currentPool) ||
    community.agentPool?.campaigns?.some((c) => c?.skillId === 'poidh')
  ) {
    changed = true;
  }

  if (!changed) {
    return { community: merged, changed: false };
  }

  return {
    community: mergeCommunityDefaults({
      ...merged,
      agentPool: cleanedPool,
      poidhBounties: poidhState,
    }),
    changed: true,
  };
}

export function isActiveAgentPoolSkill(skillId: string): boolean {
  return skillId === '0xwork' || skillId === 'qrcoin';
}
