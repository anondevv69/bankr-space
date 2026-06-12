'use client';

import Link from 'next/link';
import type { Community, TokenMarketStats } from '@/lib/types';
import { MarketStats } from '@/components/MarketStats';
import { TokenAvatar } from '@/components/TokenAvatar';
import { isNativeSpaceCommunity } from '@/lib/featured-community';

export function CommunityCard({
  community,
  market,
  featured = false,
  canDelete = false,
  onDelete,
  deleting = false,
}: {
  community: Community;
  market?: TokenMarketStats | null;
  featured?: boolean;
  canDelete?: boolean;
  onDelete?: (tokenAddress: string) => void;
  deleting?: boolean;
}) {
  const showDelete =
    canDelete && onDelete && !isNativeSpaceCommunity(community.tokenAddress);

  return (
    <div
      className={`relative rounded-xl transition-all hover:-translate-y-0.5 ${
        featured
          ? 'bg-amber-500/10 border-2 border-amber-400/70 ring-1 ring-amber-400/30 hover:border-amber-400'
          : 'bg-surface border border-border hover:border-accent'
      }`}
    >
      {showDelete ? (
        <button
          type="button"
          title="Delete space (site admin)"
          disabled={deleting}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(community.tokenAddress);
          }}
          className="absolute top-2 right-2 z-10 px-2 py-1 text-[11px] font-medium rounded-md bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      ) : null}

      <Link href={`/community/${community.tokenAddress}`} className="block p-[18px]">
        <div className="flex items-start gap-3">
          <TokenAvatar symbol={community.symbol} imageUrl={community.imageUrl} size={44} />
          <div className="min-w-0 flex-1 pr-8">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xl font-bold ${
                  featured ? 'text-amber-600 dark:text-amber-400' : 'text-accent-hover'
                }`}
              >
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
              {community.fromPetition ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent uppercase tracking-wide">
                  Petition
                </span>
              ) : null}
            </div>
            <div className="text-[15px] font-semibold mt-1 truncate">{community.name}</div>
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
    </div>
  );
}
