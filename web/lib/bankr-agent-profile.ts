const BANKR_API = 'https://api.bankr.bot';

export type BankrProfileProduct = {
  name: string;
  description?: string;
  url?: string;
};

export type BankrProfileRevenueSource = {
  name: string;
  description?: string;
};

export type BankrProjectUpdate = {
  id?: string;
  title: string;
  content: string;
  createdAt?: string;
};

export type BankrAgentProfile = {
  id?: string;
  slug?: string;
  projectName?: string;
  description?: string | null;
  profileImageUrl?: string | null;
  approved?: boolean;
  tokenAddress?: string | null;
  tokenChainId?: string | null;
  tokenSymbol?: string | null;
  tokenName?: string | null;
  twitterUsername?: string | null;
  website?: string | null;
  teamMembers?: unknown[];
  products?: BankrProfileProduct[];
  revenueSources?: BankrProfileRevenueSource[];
  projectUpdates?: BankrProjectUpdate[];
  marketCapUsd?: number | null;
  weeklyRevenueWeth?: string | null;
  createdAt?: string;
};

type BankrProfilePayload = {
  projectName?: string;
  description?: string | null;
  profileImageUrl?: string | null;
  tokenAddress?: string | null;
  website?: string | null;
  products?: BankrProfileProduct[];
  revenueSources?: BankrProfileRevenueSource[];
};

async function bankrProfileFetch<T>(
  path: string,
  options?: { apiKey?: string; method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options?.apiKey) {
    headers['X-API-Key'] = options.apiKey;
  }
  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BANKR_API}${path}`, {
    method: options?.method || (options?.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  return { ok: res.ok, status: res.status, data };
}

export async function fetchPublicBankrAgentProfile(
  identifier: string
): Promise<BankrAgentProfile | null> {
  const id = encodeURIComponent(identifier.trim());
  const { ok, status, data } = await bankrProfileFetch<BankrAgentProfile>(
    `/agent-profiles/${id}`
  );
  if (status === 404) return null;
  if (!ok) return null;
  return data;
}

export async function getBankrAgentProfile(apiKey: string): Promise<BankrAgentProfile | null> {
  const { ok, status, data } = await bankrProfileFetch<BankrAgentProfile>('/agent/profile', {
    apiKey,
  });
  if (status === 404) return null;
  if (!ok) {
    throw new Error(
      (data as { error?: string }).error ||
        (data as { message?: string }).message ||
        `Bankr profile fetch failed (${status})`
    );
  }
  return data;
}

export async function createBankrAgentProfile(
  apiKey: string,
  payload: BankrProfilePayload & { projectName: string }
): Promise<BankrAgentProfile> {
  const { ok, status, data } = await bankrProfileFetch<BankrAgentProfile>('/agent/profile', {
    apiKey,
    method: 'POST',
    body: payload,
  });
  if (!ok) {
    throw new Error(
      (data as { error?: string }).error ||
        (data as { message?: string }).message ||
        `Bankr profile create failed (${status})`
    );
  }
  return data;
}

export async function updateBankrAgentProfile(
  apiKey: string,
  payload: BankrProfilePayload
): Promise<BankrAgentProfile> {
  const { ok, status, data } = await bankrProfileFetch<BankrAgentProfile>('/agent/profile', {
    apiKey,
    method: 'PUT',
    body: payload,
  });
  if (!ok) {
    throw new Error(
      (data as { error?: string }).error ||
        (data as { message?: string }).message ||
        `Bankr profile update failed (${status})`
    );
  }
  return data;
}

export async function upsertBankrAgentProfile(
  apiKey: string,
  payload: BankrProfilePayload & { projectName: string }
): Promise<BankrAgentProfile> {
  const existing = await getBankrAgentProfile(apiKey);
  if (existing) {
    return updateBankrAgentProfile(apiKey, payload);
  }

  try {
    return await createBankrAgentProfile(apiKey, payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('409') || message.toLowerCase().includes('already exists')) {
      return updateBankrAgentProfile(apiKey, payload);
    }
    throw err;
  }
}

export async function addBankrProjectUpdate(
  apiKey: string,
  title: string,
  content: string
): Promise<BankrProjectUpdate> {
  const trimmedTitle = title.trim().slice(0, 100);
  const trimmedContent = content.trim().slice(0, 2000);
  if (!trimmedTitle || !trimmedContent) {
    throw new Error('Project update title and content are required');
  }

  const { ok, status, data } = await bankrProfileFetch<BankrProjectUpdate>(
    '/agent/profile/update',
    {
      apiKey,
      method: 'POST',
      body: { title: trimmedTitle, content: trimmedContent },
    }
  );

  if (!ok) {
    throw new Error(
      (data as { error?: string }).error ||
        (data as { message?: string }).message ||
        `Bankr project update failed (${status})`
    );
  }
  return data;
}

export function bankrAgentProfileUrl(profile: Pick<BankrAgentProfile, 'slug' | 'tokenAddress'>): string | null {
  const slug = profile.slug?.trim();
  if (slug) return `https://bankr.bot/agents/${encodeURIComponent(slug)}`;
  const token = profile.tokenAddress?.trim();
  if (token && /^0x[a-fA-F0-9]{40}$/.test(token)) {
    return `https://bankr.bot/agents/${token.toLowerCase()}`;
  }
  return null;
}

export type BankrProfileTweet = {
  id: string;
  text: string;
  createdAt?: string;
  url?: string;
  metrics?: {
    likes?: number;
    retweets?: number;
    replies?: number;
  };
};

export async function fetchBankrAgentProfileTweets(
  identifier: string
): Promise<BankrProfileTweet[]> {
  const id = encodeURIComponent(identifier.trim());
  const { ok, data } = await bankrProfileFetch<{ tweets?: BankrProfileTweet[] }>(
    `/agent-profiles/${id}/tweets`,
    { method: 'GET' }
  );
  if (!ok) return [];
  const tweets = Array.isArray(data.tweets) ? data.tweets : [];
  return tweets.filter((t) => t && t.id && t.text);
}

/** Oldest original tweet — matches Bankr discover "Original tweet" (launch / first post). */
export function pickOriginalBankrProfileTweet(
  tweets: BankrProfileTweet[]
): BankrProfileTweet | null {
  if (!tweets.length) return null;
  return [...tweets].sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  )[0];
}

export async function fetchBankrAgentProfileBundle(identifier: string): Promise<{
  profile: BankrAgentProfile | null;
  tweets: BankrProfileTweet[];
  originalTweet: BankrProfileTweet | null;
}> {
  const [profile, tweets] = await Promise.all([
    fetchPublicBankrAgentProfile(identifier),
    fetchBankrAgentProfileTweets(identifier),
  ]);
  return {
    profile,
    tweets,
    originalTweet: pickOriginalBankrProfileTweet(tweets),
  };
}
