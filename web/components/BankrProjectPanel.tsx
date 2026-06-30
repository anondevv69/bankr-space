'use client';

import type { BankrAgentProfile } from '@/lib/bankr-agent-profile';
import { bankrAgentProfileUrl } from '@/lib/bankr-agent-profile';
import type { Community } from '@/lib/types';

function formatUpdateDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BankrProjectPanel({
  community,
  profile,
}: {
  community: Community;
  profile: BankrAgentProfile | null;
}) {
  const updates = profile?.projectUpdates || [];
  const profileUrl =
    bankrAgentProfileUrl({
      slug: profile?.slug || community.bankrProject?.slug || undefined,
      tokenAddress: community.tokenAddress,
    }) || `https://bankr.bot/agents`;

  if (!profile && !community.bankrProject?.enabled) {
    return null;
  }

  return (
    <div className="mt-6 p-4 border border-border rounded-xl bg-surface space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Bankr project</h3>
          <p className="text-xs text-muted mt-1">
            {profile?.projectName || community.name} on{' '}
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-hover hover:underline"
            >
              bankr.bot/agents
            </a>
            {profile?.approved === false ? ' · pending approval' : null}
          </p>
        </div>
        {profile?.marketCapUsd != null && profile.marketCapUsd > 0 ? (
          <div className="text-right text-xs shrink-0">
            <div className="text-muted">Market cap</div>
            <div className="font-medium">
              ${profile.marketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        ) : null}
      </div>

      {community.bankrProject?.enabled ? (
        <p className="text-xs text-green-600 dark:text-green-400">
          Space sync is on
          {community.bankrProject.syncProfile ? ' · profile' : ''}
          {community.bankrProject.syncPosts ? ' · posts → project updates' : ''}
          {community.bankrProject.lastSyncError ? (
            <span className="text-amber-600 dark:text-amber-400 block mt-1">
              Last sync issue: {community.bankrProject.lastSyncError}
            </span>
          ) : null}
        </p>
      ) : null}

      {updates.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-medium text-muted">Project updates</div>
          <ul className="space-y-2">
            {updates.slice(0, 5).map((update, index) => (
              <li
                key={update.id || `${update.title}-${index}`}
                className="text-xs border border-border/60 rounded-lg p-2.5 bg-bg/50"
              >
                <div className="font-medium">{update.title}</div>
                <p className="text-muted mt-1 whitespace-pre-wrap line-clamp-3">{update.content}</p>
                {update.createdAt ? (
                  <div className="text-[10px] text-muted mt-1.5">{formatUpdateDate(update.createdAt)}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : profile ? (
        <p className="text-xs text-muted">No project updates yet.</p>
      ) : null}
    </div>
  );
}
