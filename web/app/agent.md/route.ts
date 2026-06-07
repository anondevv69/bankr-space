import { readFileSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL;
    return (v.startsWith('http') ? v : `https://${v}`).replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

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
