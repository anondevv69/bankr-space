'use client';

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
}: {
  community: Community;
  beneficiary: BeneficiaryInfo | null;
}) {
  const verifiedDate = formatVerifiedDate(community.verifiedAt);
  const xHandle = beneficiary?.xUsername?.replace(/^@/, '');

  if (community.verified) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-green-500/30 bg-green-500/5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-green-500 mb-3">
          ✓ Verified by token beneficiary
        </div>

        {beneficiary ? (
          <div className="flex flex-wrap items-start gap-4">
            {beneficiary.profileImageUrl ? (
              <img
                src={beneficiary.profileImageUrl}
                alt={xHandle ? `@${xHandle}` : 'Beneficiary'}
                className="w-12 h-12 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full border border-border bg-surface-2 flex items-center justify-center text-muted text-lg">
                ✓
              </div>
            )}

            <div className="flex-1 min-w-[200px] space-y-2">
              {beneficiary.xUrl && xHandle ? (
                <div>
                  <div className="text-xs text-muted mb-1">X account</div>
                  <a
                    href={beneficiary.xUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-accent-hover hover:underline"
                  >
                    @{xHandle}
                  </a>
                </div>
              ) : null}

              <div>
                <div className="text-xs text-muted mb-1">Beneficiary wallet</div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={beneficiary.walletUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-accent-hover hover:underline"
                  >
                    {beneficiary.wallet}
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(beneficiary.wallet)}
                    className="px-2 py-1 text-xs border border-border rounded-lg hover:border-accent"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {verifiedDate ? (
                <p className="text-xs text-muted">Verified {verifiedDate}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Verified — beneficiary details loading from Bankr.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-500 mb-2">
        Unverified — awaiting token beneficiary
      </div>

      {beneficiary ? (
        <div className="flex flex-wrap items-start gap-4 mt-2">
          {beneficiary.profileImageUrl ? (
            <img
              src={beneficiary.profileImageUrl}
              alt={xHandle ? `@${xHandle}` : 'Beneficiary'}
              className="w-10 h-10 rounded-full border border-border object-cover opacity-80"
            />
          ) : null}
          <div className="space-y-1 text-sm">
            <p className="text-muted text-xs">Fee beneficiary (from Bankr)</p>
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
            <a
              href={beneficiary.walletUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-muted hover:text-accent-hover"
            >
              {shortWallet(beneficiary.wallet)}
            </a>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted mt-1">
          The token fee beneficiary can verify this community on Bankr.
        </p>
      )}
    </div>
  );
}
