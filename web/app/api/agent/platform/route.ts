import { NextResponse } from 'next/server';
import {
  getPlatformAgentWallet,
  platformAgentMeta,
  PLATFORM_AGENT_MONEY_RULES,
  PLATFORM_AGENT_ID,
} from '@/lib/platform-agent';

export const dynamic = 'force-dynamic';

/** Public info about the Bankr Space platform agent (works across all opted-in spaces). */
export async function GET() {
  const wallet = getPlatformAgentWallet();
  return NextResponse.json({
    agentId: PLATFORM_AGENT_ID,
    wallet,
    agent: platformAgentMeta(),
    moneyRules: PLATFORM_AGENT_MONEY_RULES,
    capabilities: {
      social: 'profile, post, pin when usePlatformAgent (fee recipient opt-in)',
      fundraising: 'never enables — fee recipient only; trusted delegates may request',
      x402: 'settles to fee recipient only — agent never receives USDC',
      skills:
        'qrcoin, 0xwork only when platformAgentSkills + campaign matched (raised ≥ goal via x402)',
    },
    optIn: {
      usePlatformAgent:
        'deployer or verified fee recipient — Community agent panel on space page',
      platformAgentSkills:
        'fee recipient only — skill spend from their Bankr wallet after x402 goal matched',
    },
    install: 'install Bankr Space skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities',
  });
}
