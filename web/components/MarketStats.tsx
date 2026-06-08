'use client';

import type { TokenMarketStats } from '@/lib/types';
import { formatPct, formatUsd } from '@/lib/dexscreener';

function changeColor(value: number | null): string {
  if (value == null || Number.isNaN(value) || value === 0) return 'text-muted';
  return value > 0 ? 'text-green-500' : 'text-red-500';
}

function DexBadge({ market }: { market: TokenMarketStats }) {
  const { dexScreener } = market;
  if (dexScreener.enhancedInfoPaid) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
        <span aria-hidden>✓</span> Yes
      </span>
    );
  }
  return <span className="text-xs font-medium text-muted">No</span>;
}

export function MarketStats({
  market,
  compact = false,
  variant = 'card',
}: {
  market: TokenMarketStats | null;
  compact?: boolean;
  variant?: 'card' | 'hero' | 'inline';
}) {
  if (!market) {
    return <div className="text-xs text-muted">Loading market data…</div>;
  }

  if (!market.found) {
    if (variant === 'hero') return null;
    return (
      <div className="mt-4 p-3 bg-surface-2 border border-border rounded-lg text-sm text-muted">
        No DEX trading data on DexScreener yet.
      </div>
    );
  }

  if (compact || variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted">
        <span>MCap {formatUsd(market.marketCap)}</span>
        <span className={changeColor(market.priceChange24h)}>
          24h {formatPct(market.priceChange24h)}
        </span>
        {market.dexScreener.enhancedInfoPaid ? (
          <span className="text-green-600 dark:text-green-400 font-semibold">Dex paid ✓</span>
        ) : null}
      </div>
    );
  }

  if (variant === 'hero') {
    const txnTotal =
      market.txns24h != null
        ? market.txns24h.buys + market.txns24h.sells
        : null;

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 py-4 border-y border-border my-4">
        <HeroStat label="Market Cap" value={formatUsd(market.marketCap)} />
        <HeroStat label="Liquidity" value={formatUsd(market.liquidityUsd)} />
        <HeroStat
          label="24h Change"
          value={formatPct(market.priceChange24h)}
          valueClass={changeColor(market.priceChange24h)}
        />
        <HeroStat label="24h Txns" value={txnTotal != null ? String(txnTotal) : '—'} />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted font-medium">
            DEX PAID
          </div>
          <div className="mt-1">
            <DexBadge market={market} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 p-4 bg-surface-2 border border-border rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-sm font-semibold">Market</div>
        <div className="flex flex-wrap items-center gap-2">
          {market.dexScreener.enhancedInfoPaid ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
              Dex paid ✓
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted">
              Dex not paid
            </span>
          )}
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
              ? `${market.txns24h.buys + market.txns24h.sells}`
              : '—'
          }
        />
      </div>
    </div>
  );
}

function HeroStat({
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
      <div className="text-[11px] uppercase tracking-wide text-muted font-medium">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${valueClass}`}>{value}</div>
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
