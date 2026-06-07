'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatTime } from '@/lib/utils';

export function Header({ syncUpdatedAt }: { syncUpdatedAt?: number | null }) {
  return (
    <header className="mb-7">
      <h1 className="text-[26px] font-bold tracking-tight">Bankr Communities</h1>
      <p className="text-muted text-sm mt-1">
        Token-gated communities for Bankr-deployed tokens
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px]">
        <ConnectButton chainStatus="none" showBalance={false} />
        {syncUpdatedAt ? (
          <span className="text-muted text-xs">
            Last synced: {formatTime(syncUpdatedAt)}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export function Footer() {
  return (
  <footer className="text-center py-8 text-muted text-[13px]">
    made with love &lt;3 rayblanco.eth · web v1
    {' · '}
    <a
      href="/agent.md"
      className="text-accent-hover hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      agent.md
    </a>
  </footer>
  );
}
