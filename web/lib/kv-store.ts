import { createClient as createKvClient } from '@vercel/kv';
import { createClient as createRedisClient } from 'redis';

type KvStore = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
};

type RedisClient = ReturnType<typeof createRedisClient>;

declare global {
  // eslint-disable-next-line no-var
  var __bankrRedis: RedisClient | undefined;
}

async function getRedisClient(): Promise<RedisClient> {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set');
  }

  if (!global.__bankrRedis) {
    const client = createRedisClient({ url });
    client.on('error', (err) => console.error('Redis client error', err));
    global.__bankrRedis = client;
  }

  if (!global.__bankrRedis.isOpen) {
    await global.__bankrRedis.connect();
  }

  return global.__bankrRedis;
}

function createRedisStore(): KvStore {
  return {
    async get<T>(key: string): Promise<T | null> {
      const client = await getRedisClient();
      const raw = await client.get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as T;
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      const client = await getRedisClient();
      await client.set(key, JSON.stringify(value));
    },
  };
}

function createRestStore(): KvStore {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

  if (!url || !token) {
    throw new Error(
      'Database not configured. Connect Vercel Redis (REDIS_URL) or Upstash/KV REST credentials — see web/DEPLOY.md'
    );
  }

  const client = createKvClient({ url, token });
  return {
    get: <T>(key: string) => client.get<T>(key),
    set: async (key: string, value: unknown) => {
      await client.set(key, value);
    },
  };
}

let store: KvStore | null = null;

function getStore(): KvStore {
  if (store) return store;

  if (process.env.REDIS_URL) {
    store = createRedisStore();
  } else {
    store = createRestStore();
  }

  return store;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  return getStore().get<T>(key);
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await getStore().set(key, value);
}
