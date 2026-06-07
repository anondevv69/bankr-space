import { readFileSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

function getAgentMarkdown(): string {
  const path = join(process.cwd(), 'content', 'agent.md');
  const raw = readFileSync(path, 'utf8');
  return raw.replace(/\{\{SITE_URL\}\}/g, getSiteUrl());
}

export async function GET() {
  const body = getAgentMarkdown();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
