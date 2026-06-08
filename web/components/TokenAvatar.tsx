'use client';

import { useState } from 'react';

export function TokenAvatar({
  symbol,
  imageUrl,
  size = 40,
  className = '',
}: {
  symbol: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (symbol || '?').slice(0, 2).toUpperCase();

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={`${symbol} token`}
        width={size}
        height={size}
        className={`rounded-xl object-cover border border-border shrink-0 bg-surface-2 ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`rounded-xl border border-border bg-surface-2 shrink-0 flex items-center justify-center font-bold text-accent-hover ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.32) }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
