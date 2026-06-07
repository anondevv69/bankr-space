'use client';

import type { Author } from '@/lib/types';
import { shortAddr } from '@/lib/utils';

export function AuthorBlock({ author }: { author: Author }) {
  const displayName = author.twitter
    ? `@${author.twitter}`
    : author.farcaster
      ? `@${author.farcaster}`
      : shortAddr(author.wallet);

  return (
    <div className="flex gap-3 mb-3">
      {author.profileImage ? (
        <img
          src={author.profileImage}
          alt=""
          className="w-9 h-9 rounded-full object-cover"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center text-lg">
          👤
        </div>
      )}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{displayName}</span>
          {author.twitter ? (
            <span className="text-[11px] px-2 py-0.5 rounded bg-surface-2">𝕏 @{author.twitter}</span>
          ) : null}
          {author.farcaster ? (
            <span className="text-[11px] px-2 py-0.5 rounded bg-surface-2">FC @{author.farcaster}</span>
          ) : null}
        </div>
        <div className="text-xs text-muted font-mono mt-0.5">{author.wallet}</div>
      </div>
    </div>
  );
}
