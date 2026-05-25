import Redis, { type RedisOptions } from "ioredis";

// Shared ioredis client. Hot-reload safe via globalThis.
const globalForRedis = globalThis as unknown as { redis?: Redis };

function build(): Redis {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const opts: RedisOptions = {
    maxRetriesPerRequest: null, // long-running connections
    enableReadyCheck: true,
    lazyConnect: false,
  };
  return new Redis(url, opts);
}

export const redis = globalForRedis.redis ?? build();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
