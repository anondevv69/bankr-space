import type { WalletAgentMeta } from '@/lib/types';

export function AgentWalletBadge({ agent }: { agent?: WalletAgentMeta | null }) {
  if (!agent?.agentType || agent.agentType === 'unknown') return null;

  const label = agent.isAgentWallet
    ? agent.agentLabel || agent.agentId || agent.agentType
    : agent.agentLabel
      ? `${agent.agentLabel} · human`
      : 'human';

  const tone = agent.isAgentWallet
    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30'
    : 'bg-surface-2 text-muted border-border';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tone}`}
      title={agent.agentId ? `Agent: ${agent.agentId}` : undefined}
    >
      {agent.isAgentWallet ? '🤖' : '👤'} {label}
      {agent.isAgentWallet && agent.agentType ? (
        <span className="opacity-70">({agent.agentType})</span>
      ) : null}
    </span>
  );
}
