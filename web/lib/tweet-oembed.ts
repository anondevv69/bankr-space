import { extractTweetStatusId } from './tweet-url';

export type TweetPreview = {
  url: string;
  authorName: string;
  authorHandle: string | null;
  authorUrl: string;
  text: string;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—');
}

function parseTweetTextFromHtml(html: string): string {
  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!paragraph?.[1]) return '';

  const withoutLinks = paragraph[1].replace(/<a[^>]*>[\s\S]*?<\/a>/gi, '');
  const stripped = withoutLinks.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return decodeHtmlEntities(stripped);
}

function parseAuthorHandle(authorUrl: string): string | null {
  try {
    const path = new URL(authorUrl).pathname.replace(/^\//, '');
    return path ? `@${path.split('/')[0]}` : null;
  } catch {
    return null;
  }
}

export async function fetchTweetPreview(url: string): Promise<TweetPreview | null> {
  const statusId = extractTweetStatusId(url);
  if (!statusId) return null;

  const endpoint = new URL('https://publish.x.com/oembed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('omit_script', '1');
  endpoint.searchParams.set('dnt', 'true');

  const res = await fetch(endpoint.toString(), {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (!data?.url || !data?.author_name) return null;

  const text = parseTweetTextFromHtml(String(data.html || ''));
  const authorUrl = String(data.author_url || '');

  return {
    url: String(data.url),
    authorName: String(data.author_name),
    authorHandle: parseAuthorHandle(authorUrl),
    authorUrl,
    text,
  };
}
