import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;

function getRedisUrl(): string {
  // 本地 redis，端口 6379，密码 root
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT || 6379);
  const password = process.env.REDIS_PASSWORD || "root";
  return `redis://:${password}@${host}:${port}`;
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({
      url: getRedisUrl()
    });
    client.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("Redis client error", err);
    });
    await client.connect();
  }
  return client;
}

export async function isMemberOfSet(
  key: string,
  member: string
): Promise<boolean> {
  const c = await getRedisClient();
  const exists = await c.sIsMember(key, member);
  return Boolean(exists);
}

export async function addMemberToSet(
  key: string,
  member: string
): Promise<void> {
  const c = await getRedisClient();
  await c.sAdd(key, member);
}

export async function removeMemberFromSet(
  key: string,
  member: string
): Promise<void> {
  const c = await getRedisClient();
  await c.sRem(key, member);
}

