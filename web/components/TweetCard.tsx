'use client';

import { useEffect, useState } from 'react';
import type { TweetPreview } from '@/lib/tweet-oembed';

export function TweetCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<TweetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPreview(null);

    fetch(`/api/oembed/tweet?url=${encodeURIComponent(url)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('preview unavailable');
        const data = await res.json();
        if (!cancelled) setPreview(data.preview || null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="my-2 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted animate-pulse">
        Loading tweet preview…
      </div>
    );
  }

  if (failed || !preview) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block my-1 text-accent-hover hover:underline break-all"
      >
        {url}
      </a>
    );
  }

  const handle = preview.authorHandle || `@${preview.authorName}`;

  return (
    <div className="my-2 rounded-xl border border-border bg-surface-2 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm">
        <span className="font-semibold text-text">{handle}</span>
        <span className="text-muted">{preview.authorName}</span>
      </div>
      {preview.text ? (
        <p className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{preview.text}</p>
      ) : null}
      <div className="px-4 py-2.5 border-t border-border">
        <a
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-accent-hover hover:underline"
        >
          View on X →
        </a>
      </div>
    </div>
  );
}
