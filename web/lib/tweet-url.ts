const TWEET_URL_RE =
  /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s/]+\/status\/(\d+)(?:\?[^\s]*)?/gi;

export function extractTweetStatusId(url: string): string | null {
  const match = url.match(
    /(?:twitter\.com|x\.com)\/[^\s/]+\/status\/(\d+)/i
  );
  return match?.[1] || null;
}

export function isTweetUrl(url: string): boolean {
  return extractTweetStatusId(url) !== null;
}

export type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'tweet'; value: string };

/** Split post body into plain text and standalone tweet URL lines/segments. */
export function splitPostContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(TWEET_URL_RE.source, 'gi');
  while ((match = re.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before) segments.push({ type: 'text', value: before });

    segments.push({ type: 'tweet', value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  const tail = content.slice(lastIndex);
  if (tail) segments.push({ type: 'text', value: tail });

  return segments.length ? segments : [{ type: 'text', value: content }];
}

export const GENERIC_URL_RE = /https?:\/\/[^\s<>"']+/gi;
