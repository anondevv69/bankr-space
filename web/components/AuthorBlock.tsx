'use client';

import type { Author } from '@/lib/types';
import { shortAddr } from '@/lib/utils';

export function AuthorBlock({
  author,
  isBeneficiary = false,
  compact = false,
}: {
  author: Author;
  isBeneficiary?: boolean;
  compact?: boolean;
}) {
  const displayName = author.twitter
    ? `@${author.twitter.replace(/^@/, '')}`
    : author.farcaster
      ? `@${author.farcaster.replace(/^@/, '')}`
      : shortAddr(author.wallet);

  return (
    <div className={`flex gap-3 ${compact ? 'mb-0' : 'mb-3'}`}>
      {author.profileImage ? (
        <img
          src={author.profileImage}
          alt=""
          className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-lg shrink-0">
          👤
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{displayName}</span>
          {isBeneficiary ? (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
              Beneficiary
            </span>
          ) : null}
        </div>
        <div className="text-xs text-muted font-mono mt-0.5 truncate">{shortAddr(author.wallet)}</div>
      </div>
    </div>
  );
}
