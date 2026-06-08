'use client';

import type { TokenMarketStats } from '@/lib/types';

export function DexPaidBanner({ market }: { market: TokenMarketStats | null }) {
  if (!market?.found || !market.dexScreener.enhancedInfoPaid) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-6 rounded-xl border border-green-500/30 bg-green-500/5 text-sm">
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <span aria-hidden>✓</span>
        <span>This token has paid for enhanced token info on DexScreener.</span>
      </div>
      {market.dexUrl ? (
        <a
          href={market.dexUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-accent-hover hover:underline shrink-0"
        >
          View on DexScreener →
        </a>
      ) : null}
    </div>
  );
}
