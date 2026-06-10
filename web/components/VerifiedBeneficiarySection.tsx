'use client';

import { AgentWalletBadge } from '@/components/AgentWalletBadge';
import type { BeneficiaryInfo, Community } from '@/lib/types';
import { shortWallet } from '@/lib/social-links';

function formatVerifiedDate(ts: number | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function VerifiedBeneficiarySection({
  community,
  beneficiary,
  layout = 'stacked',
}: {
  community: Community;
  beneficiary: BeneficiaryInfo | null;
  layout?: 'stacked' | 'sidebar';
}) {
  const verifiedDate = formatVerifiedDate(community.verifiedAt);
  const xHandle = beneficiary?.xUsername?.replace(/^@/, '');

  const shellClass =
    layout === 'sidebar'
      ? 'p-5 rounded-xl border border-border bg-surface h-fit'
      : 'mt-4 p-4 rounded-xl border';

  if (community.verified) {
    return (
      <div className={`${shellClass} border-green-500/30 bg-green-500/5`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-500 mb-4">
          ✓ Verified by token beneficiary
        </div>

        {beneficiary ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {beneficiary.profileImageUrl ? (
                <img
                  src={beneficiary.profileImageUrl}
                  alt={xHandle ? `@${xHandle}` : 'Beneficiary'}
                  className="w-11 h-11 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full border border-border bg-surface-2 flex items-center justify-center text-muted">
                  ✓
                </div>
              )}
              <div className="min-w-0">
                {beneficiary.xUrl && xHandle ? (
                  <a
                    href={beneficiary.xUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-accent-hover hover:underline"
                  >
                    @{xHandle}
                  </a>
                ) : null}
                <div className="mt-1">
                  <AgentWalletBadge agent={beneficiary.agent} />
                </div>
              </div>
            </div>

            {beneficiary.xUrl && xHandle ? (
              <div>
                <div className="text-[11px] text-muted mb-1">X account</div>
                <a
                  href={beneficiary.xUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-accent-hover hover:underline"
                >
                  @{xHandle}
                </a>
              </div>
            ) : null}

            <div>
              <div className="text-[11px] text-muted mb-1">Beneficiary wallet</div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-xs text-accent-hover break-all">
                  {layout === 'sidebar' ? shortWallet(beneficiary.wallet) : beneficiary.wallet}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(beneficiary.wallet)}
                  className="px-2 py-1 text-xs border border-border rounded-lg hover:border-accent bg-surface"
                >
                  Copy
                </button>
              </div>
            </div>

            {verifiedDate ? (
              <p className="text-xs text-muted pt-2 border-t border-border">
                Verified {verifiedDate}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">Verified — beneficiary details loading from Bankr.</p>
        )}
      </div>
    );
  }

  return (
    <div className={`${shellClass} border-amber-500/30 bg-amber-500/5`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500 mb-2">
        Unverified — awaiting token beneficiary
      </div>
      {beneficiary ? (
        <div className="space-y-2 text-sm">
          {beneficiary.xUrl && xHandle ? (
            <a
              href={beneficiary.xUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent-hover hover:underline block"
            >
              @{xHandle}
            </a>
          ) : null}
          <code className="font-mono text-xs text-muted block">{shortWallet(beneficiary.wallet)}</code>
        </div>
      ) : (
        <p className="text-xs text-muted mt-1">
          The token fee beneficiary can verify this space on Bankr.
        </p>
      )}
    </div>
  );
}
