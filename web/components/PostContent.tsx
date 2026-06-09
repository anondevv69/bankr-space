'use client';

import type { ReactNode } from 'react';
import { splitPostContent, GENERIC_URL_RE } from '@/lib/tweet-url';
import { TweetCard } from './TweetCard';

function linkifyText(text: string) {
  const parts = text.split(GENERIC_URL_RE);
  const urls = text.match(GENERIC_URL_RE) || [];

  if (!urls.length) return text;

  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part) nodes.push(part);
    const url = urls[index];
    if (url) {
      nodes.push(
        <a
          key={`${url}-${index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-hover hover:underline break-all"
        >
          {url}
        </a>
      );
    }
  });

  return nodes;
}

export function PostContent({
  content,
  className = '',
}: {
  content: string;
  className?: string;
}) {
  const segments = splitPostContent(content);

  return (
    <div className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'tweet') {
          return <TweetCard key={`tweet-${index}`} url={segment.value.trim()} />;
        }

        const trimmed = segment.value;
        if (!trimmed) return null;

        return (
          <p key={`text-${index}`} className="text-sm whitespace-pre-wrap leading-relaxed">
            {linkifyText(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
