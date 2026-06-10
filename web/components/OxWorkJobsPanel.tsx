'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OxWorkTask } from '@/lib/oxwork-api';
import { oxWorkTaskUrl } from '@/lib/oxwork-api';

function taskTitle(task: OxWorkTask): string {
  if (task.title?.trim()) return task.title.trim();
  const line = task.description.split('\n')[0]?.trim() || 'Open task';
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

function formatBounty(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

export function OxWorkJobsPanel({
  tokenAddress,
  symbol,
}: {
  tokenAddress: string;
  symbol: string;
}) {
  const [tasks, setTasks] = useState<OxWorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usePlatformAgent, setUsePlatformAgent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}/oxwork`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load jobs');
      setTasks(data.tasks || []);
      setUsePlatformAgent(!!data.usePlatformAgent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <p className="text-center text-muted py-12 border border-dashed border-border rounded-xl bg-surface">
        Loading 0xJobs…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-center text-red-400 py-12 border border-dashed border-border rounded-xl bg-surface">
        {error}
      </p>
    );
  }

  if (!tasks.length) {
    return (
      <div className="text-center py-12 px-6 border border-dashed border-border rounded-xl bg-surface space-y-3">
        <p className="text-muted text-sm">No open 0xJobs for ${symbol} yet.</p>
        <p className="text-xs text-muted max-w-md mx-auto">
          Holders fund a 0xWork pool via x402 (USDC stays with the fee recipient). Once the goal
          is matched, Bankr Space Agent can post bounties on{' '}
          <a
            href="https://0xwork.org"
            target="_blank"
            rel="noreferrer"
            className="text-accent-hover hover:underline"
          >
            0xWork
          </a>{' '}
          — bagwork, tweets, art, and more. Enable{' '}
          <span className="font-medium">Run skill-linked fundraisers</span> in Team access.
        </p>
        {usePlatformAgent ? (
          <p className="text-xs text-green-600 dark:text-green-400">
            Bankr Space Agent is enabled — jobs appear here after a matched 0xWork fundraiser runs.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Open bounties posted by the ${symbol} fee recipient on{' '}
        <a
          href="https://0xwork.org"
          target="_blank"
          rel="noreferrer"
          className="text-accent-hover hover:underline"
        >
          0xWork
        </a>
        . Holders and agents can claim tasks and earn USDC.
      </p>
      <ul className="space-y-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="p-4 border border-border rounded-xl bg-surface hover:border-accent/40 transition-colors"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/25">
                    {task.category}
                  </span>
                  <span className="text-xs text-muted">{task.status}</span>
                  {task.require_approval ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400">approval</span>
                  ) : null}
                </div>
                <h3 className="text-sm font-medium leading-snug">{taskTitle(task)}</h3>
                <p className="text-xs text-muted mt-2 line-clamp-3 whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {formatBounty(task.bounty_amount)}
                </div>
                <div className="text-[10px] text-muted uppercase tracking-wide">USDC</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-muted">
              {task.poster_agent_name ? (
                <span>Posted by {task.poster_agent_name}</span>
              ) : null}
              {task.application_count > 0 ? (
                <span>{task.application_count} applications</span>
              ) : null}
              {task.attempt_count > 0 ? <span>{task.attempt_count} attempts</span> : null}
              <a
                href={oxWorkTaskUrl(task.id)}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-accent-hover hover:underline font-medium"
              >
                View on 0xWork ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
