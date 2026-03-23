// Upstash Redis REST helpers

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL ?? '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

export async function redisGet(key: string): Promise<string | null> {
  if (!UPSTASH_REDIS_REST_URL) return null;
  const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  const data = (await res.json()) as { result: string | null };
  return data.result;
}

export async function redisSet(key: string, value: string, ttlSeconds: number) {
  if (!UPSTASH_REDIS_REST_URL) return;
  await fetch(`${UPSTASH_REDIS_REST_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value, ex: ttlSeconds }),
  });
}
