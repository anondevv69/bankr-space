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
      social: 'profile, post, pin on opted-in verified spaces',
      fundraising: 'never enables — fee recipient only',
      x402: 'never receives — fee recipient wallet only',
      skills: 'qrcoin, 0xwork when platformAgentSkills opt-in + fee recipient Bankr auth',
    },
    optIn: {
      usePlatformAgent: 'fee recipient checkbox — Edit profile → Team access',
      platformAgentSkills: 'allows skill execution against fee recipient USDC',
    },
    install: 'install Bankr Space skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities',
  });
}
