'use client';

import Link from 'next/link';
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

  const profileHref = `/profile?wallet=${encodeURIComponent(author.wallet)}`;

  return (
    <div className={`flex gap-3 ${compact ? 'mb-0' : 'mb-3'}`}>
      <Link href={profileHref} className="shrink-0">
        {author.profileImage ? (
          <img
            src={author.profileImage}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-border hover:border-accent/50 transition-colors"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-surface-2 border border-border hover:border-accent/50 flex items-center justify-center text-lg transition-colors">
            👤
          </div>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={profileHref}
            className="font-semibold text-sm hover:text-accent hover:underline"
          >
            {displayName}
          </Link>
          {isBeneficiary ? (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
              Beneficiary
            </span>
          ) : null}
        </div>
        <Link
          href={profileHref}
          className="text-xs text-muted font-mono mt-0.5 truncate block hover:text-accent hover:underline"
        >
          {shortAddr(author.wallet)}
        </Link>
      </div>
    </div>
  );
}
