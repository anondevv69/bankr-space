'use client';

import type { TokenMarketStats } from '@/lib/types';
import { formatPct, formatUsd } from '@/lib/dexscreener';

function changeColor(value: number | null): string {
  if (value == null || Number.isNaN(value) || value === 0) return 'text-muted';
  return value > 0 ? 'text-green-400' : 'text-red-400';
}

function DexBadge({ market }: { market: TokenMarketStats }) {
  const { dexScreener } = market;
  if (dexScreener.enhancedInfoPaid) {
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
        Dex paid ✓
      </span>
    );
  }
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted">
      Dex not paid
    </span>
  );
}

export function MarketStats({
  market,
  compact = false,
}: {
  market: TokenMarketStats | null;
  compact?: boolean;
}) {
  if (!market) {
    return (
      <div className="text-xs text-muted mt-3">
        Loading market data…
      </div>
    );
  }

  if (!market.found) {
    return (
      <div className="mt-4 p-3 bg-surface-2 border border-border rounded-lg text-sm text-muted">
        No DEX trading data on DexScreener yet.
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted">
        <span>MCap {formatUsd(market.marketCap)}</span>
        <span className={changeColor(market.priceChange24h)}>
          24h {formatPct(market.priceChange24h)}
        </span>
        <DexBadge market={market} />
      </div>
    );
  }

  return (
    <div className="mt-5 p-4 bg-surface-2 border border-border rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-sm font-semibold">Market</div>
        <div className="flex flex-wrap items-center gap-2">
          <DexBadge market={market} />
          {market.dexScreener.boostActive ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
              Boost active
            </span>
          ) : null}
          {market.dexUrl ? (
            <a
              href={market.dexUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent-hover hover:underline"
            >
              View on DexScreener →
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Market cap" value={formatUsd(market.marketCap)} />
        <Stat label="24h volume" value={formatUsd(market.volume24h)} />
        <Stat
          label="24h change"
          value={formatPct(market.priceChange24h)}
          valueClass={changeColor(market.priceChange24h)}
        />
        <Stat label="Liquidity" value={formatUsd(market.liquidityUsd)} />
        <Stat label="Price" value={formatUsd(market.priceUsd)} />
        <Stat
          label="24h txns"
          value={
            market.txns24h
              ? `${market.txns24h.buys} buys · ${market.txns24h.sells} sells`
              : '—'
          }
        />
      </div>

      <p className="text-[11px] text-muted mt-3">
        Data from DexScreener (highest-liquidity pair). &quot;Dex paid&quot; means Enhanced Token
        Info was purchased — not a safety guarantee.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass = 'text-text',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-sm font-semibold mt-1 ${valueClass}`}>{value}</div>
    </div>
  );
}
