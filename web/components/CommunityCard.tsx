'use client';

import Link from 'next/link';
import type { Community, TokenMarketStats } from '@/lib/types';
import { MarketStats } from '@/components/MarketStats';
import { TokenAvatar } from '@/components/TokenAvatar';

export function CommunityCard({
  community,
  market,
  featured = false,
}: {
  community: Community;
  market?: TokenMarketStats | null;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/community/${community.tokenAddress}`}
      className={`block rounded-xl p-[18px] transition-all hover:-translate-y-0.5 ${
        featured
          ? 'bg-amber-500/10 border-2 border-amber-400/70 ring-1 ring-amber-400/30 hover:border-amber-400'
          : 'bg-surface border border-border hover:border-accent'
      }`}
    >
      <div className="flex items-start gap-3">
        <TokenAvatar symbol={community.symbol} imageUrl={community.imageUrl} size={44} />
        <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xl font-bold ${featured ? 'text-amber-600 dark:text-amber-400' : 'text-accent-hover'}`}>
          {community.symbol}
        </span>
        {featured ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300">
            Bankr Space
          </span>
        ) : null}
        {community.verified ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
            ✓ Verified
          </span>
        ) : !featured ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
            Unverified
          </span>
        ) : null}
      </div>
      <div className="text-[15px] font-semibold mt-1">{community.name}</div>
      <MarketStats market={market ?? null} compact />
      <div className="flex gap-3 mt-3 text-xs text-muted">
        <span className="uppercase bg-surface-2 px-2 py-0.5 rounded-full">
          {community.chain || 'base'}
        </span>
        <span>💬 {community.postCount || 0}</span>
        <span>👥 {community.memberCount || 0}</span>
      </div>
        </div>
      </div>
    </Link>
  );
}
