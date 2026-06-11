import { getCommunities, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { matchedAgentPoolCampaigns, readStoredAgentPool } from '@/lib/agent-pool';
import {
  getPlatformAgentBankrApiKey,
  pollBankrAgentJob,
  submitBankrAgentPrompt,
} from '@/lib/bankr-agent-client';
import { createPlatformAgentPost } from '@/lib/agent-pool-feed';
import { markAgentPoolExecuted } from '@/lib/mark-pool-executed';
import { verifyAgentPoolForCommunity } from '@/lib/agent-pool-verify';
import { pickOxWorkTaskForCampaign } from '@/lib/agent-pool-verify';
import { fetchOxWorkTasksForSpace, oxWorkTaskUrl } from '@/lib/oxwork-api';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { communityUrl } from '@/lib/site-url';
import {
  buildOxWorkAgentPrompt,
  buildQrcoinAgentPrompt,
  extractOxWorkTaskId,
  extractTxHash,
} from '@/lib/work-brief';
import type { AgentPoolCampaign, Community } from '@/lib/types';
import type { AgentPoolSkillId } from '@/lib/types';

export type AgentPoolExecuteItemResult = {
  tokenAddress: string;
  symbol: string;
  skillId: AgentPoolSkillId;
  status: 'executed' | 'skipped' | 'failed' | 'pending_api_key' | 'pending_job';
  message?: string;
  oxworkTaskId?: number | null;
  bankrAgentJobId?: string | null;
};

async function setCampaignBankrJobId(
  tokenAddress: string,
  skillId: AgentPoolSkillId,
  jobId: string | null
): Promise<void> {
  const communities = await getCommunities();
  const index = communities.findIndex(
    (c) => c.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (index === -1) return;

  const current = mergeCommunityDefaults(communities[index]);
  const pool = readStoredAgentPool(current.agentPool);
  communities[index] = mergeCommunityDefaults({
    ...current,
    agentPool: {
      ...pool,
      campaigns: pool.campaigns.map((c) =>
        c.skillId === skillId ? { ...c, bankrAgentJobId: jobId } : c
      ),
    },
  });
  await setCommunities(communities);
}

async function runBankrAgentWithResume(
  tokenAddress: string,
  skillId: AgentPoolSkillId,
  campaign: AgentPoolCampaign,
  prompt: string
): Promise<string> {
  let jobId = campaign.bankrAgentJobId?.trim() || null;
  if (!jobId) {
    jobId = await submitBankrAgentPrompt(prompt);
    await setCampaignBankrJobId(tokenAddress, skillId, jobId);
  }

  try {
    const result = await pollBankrAgentJob(jobId, { maxAttempts: 90, delayMs: 2000 });
    await setCampaignBankrJobId(tokenAddress, skillId, null);
    return result.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('timed out')) {
      throw new Error(`PENDING_JOB:${jobId}`);
    }
    await setCampaignBankrJobId(tokenAddress, skillId, null);
    throw err;
  }
}

export type AgentPoolExecuteResult = {
  configured: boolean;
  spacesProcessed: number;
  attempted: number;
  executed: number;
  failed: number;
  skipped: number;
  items: AgentPoolExecuteItemResult[];
};

async function resolveOxWorkTaskId(
  community: Community,
  campaign: AgentPoolCampaign
): Promise<number | null> {
  if (campaign.oxworkTaskId != null) return campaign.oxworkTaskId;

  const platformWallet = getPlatformAgentWallet();
  const posters = [platformWallet, community.ownerWallet].filter(
    (w): w is string => !!w?.startsWith('0x')
  );
  if (!posters.length) return null;

  const fetched = await fetchOxWorkTasksForSpace({
    posterWallets: posters,
    symbol: community.symbol,
    tokenAddress: community.tokenAddress,
    includeAllStatuses: true,
  });

  const task = pickOxWorkTaskForCampaign(
    fetched.tasks,
    campaign,
    community.symbol,
    community.tokenAddress
  );
  return task?.id ?? null;
}

async function executeCampaign(
  community: Community,
  campaign: AgentPoolCampaign
): Promise<AgentPoolExecuteItemResult> {
  const base = {
    tokenAddress: community.tokenAddress,
    symbol: community.symbol,
    skillId: campaign.skillId,
  };

  if (!community.platformAgentSkills) {
    return { ...base, status: 'skipped', message: 'platformAgentSkills off' };
  }

  if (campaign.executedAt) {
    return { ...base, status: 'skipped', message: 'already executed' };
  }

  if (!getPlatformAgentBankrApiKey()) {
    return {
      ...base,
      status: 'pending_api_key',
      message: 'Set PLATFORM_AGENT_BANKR_API_KEY on Vercel',
    };
  }

  try {
    let resultText = '';
    let oxworkTaskId: number | null = campaign.oxworkTaskId ?? null;

    if (campaign.skillId === '0xwork') {
      oxworkTaskId = await resolveOxWorkTaskId(community, campaign);
      if (oxworkTaskId == null) {
        const prompt = buildOxWorkAgentPrompt({
          symbol: community.symbol,
          tokenAddress: community.tokenAddress,
          workBrief: campaign.workBrief ?? null,
          goalUsd: campaign.goalUsd,
        });
        try {
          resultText = await runBankrAgentWithResume(
            community.tokenAddress,
            campaign.skillId,
            campaign,
            prompt
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.startsWith('PENDING_JOB:')) {
            const jobId = message.slice('PENDING_JOB:'.length);
            return {
              ...base,
              status: 'pending_job',
              message: `Bankr agent still running (${jobId}) — cron will retry`,
              bankrAgentJobId: jobId,
            };
          }
          throw err;
        }
        oxworkTaskId = extractOxWorkTaskId(resultText);
        if (oxworkTaskId == null) {
          const verified = await verifyAgentPoolForCommunity(community, { persist: true });
          const pool = readStoredAgentPool(verified.community.agentPool);
          const updated = pool.campaigns.find((c) => c.skillId === '0xwork');
          oxworkTaskId = updated?.oxworkTaskId ?? null;
          if (oxworkTaskId == null) {
            oxworkTaskId = await resolveOxWorkTaskId(verified.community, campaign);
          }
        }
      }
    } else if (campaign.skillId === 'qrcoin') {
      const prompt = buildQrcoinAgentPrompt({
        symbol: community.symbol,
        tokenAddress: community.tokenAddress,
      });
      try {
        resultText = await runBankrAgentWithResume(
          community.tokenAddress,
          campaign.skillId,
          campaign,
          prompt
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('PENDING_JOB:')) {
          const jobId = message.slice('PENDING_JOB:'.length);
          return {
            ...base,
            status: 'pending_job',
            message: `Bankr agent still running (${jobId}) — cron will retry`,
            bankrAgentJobId: jobId,
          };
        }
        throw err;
      }
    }

    const txHash = extractTxHash(resultText);
    const taskUrl = oxworkTaskId != null ? oxWorkTaskUrl(oxworkTaskId) : null;
    const note =
      campaign.skillId === '0xwork' && taskUrl
        ? `0xWork task posted — ${taskUrl}`
        : resultText.slice(0, 400) || `${campaign.skillId} executed`;

    const feedLines = [
      `$${community.symbol} — community agent pool: ${campaign.label}`,
      `Raised $${campaign.raisedUsd} / $${campaign.goalUsd} USDC — skill executed.`,
      taskUrl ? `0xJob: ${taskUrl}` : null,
      communityUrl(community.tokenAddress),
    ]
      .filter(Boolean)
      .join('\n');

    await createPlatformAgentPost(community.tokenAddress, feedLines);
    await markAgentPoolExecuted({
      tokenAddress: community.tokenAddress,
      skillId: campaign.skillId,
      executionNote: note,
      executionTxHash: txHash,
      oxworkTaskId,
    });

    return {
      ...base,
      status: 'executed',
      message: note,
      oxworkTaskId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    console.error('agent-pool-execute', community.tokenAddress, campaign.skillId, message);
    return { ...base, status: 'failed', message };
  }
}

export async function executeReadyAgentPoolGoals(): Promise<AgentPoolExecuteResult> {
  const configured = Boolean(getPlatformAgentBankrApiKey());
  const communities = await getCommunities();
  const items: AgentPoolExecuteItemResult[] = [];
  let spacesProcessed = 0;

  for (const raw of communities) {
    const merged = mergeCommunityDefaults(raw);
    if (!merged.usePlatformAgent || !merged.verified || !merged.platformAgentSkills) {
      continue;
    }

    const pool = readStoredAgentPool(merged.agentPool);
    const ready = matchedAgentPoolCampaigns(pool);
    if (!ready.length) continue;

    spacesProcessed += 1;

    for (const campaign of ready) {
      items.push(await executeCampaign(merged, campaign));
    }
  }

  return {
    configured,
    spacesProcessed,
    attempted: items.filter((i) => i.status !== 'skipped').length,
    executed: items.filter((i) => i.status === 'executed').length,
    failed: items.filter((i) => i.status === 'failed').length,
    skipped: items.filter((i) => i.status === 'skipped').length,
    items,
  };
}
