import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "./env";

// Login rate limiting (spec Section 10): email 5/15min, IP 20/15min.
// If Upstash credentials are not configured, returns a no-op limiter so local
// dev keeps working — wire credentials before going to production.

type Limiter = {
  limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }>;
};

let cachedRedis: Redis | null = null;
function redis(): Redis | null {
  const e = env();
  if (!e.UPSTASH_REDIS_REST_URL || !e.UPSTASH_REDIS_REST_TOKEN) return null;
  if (cachedRedis) return cachedRedis;
  cachedRedis = new Redis({ url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN });
  return cachedRedis;
}

function buildLimiter(prefix: string, max: number, windowSecs: number): Limiter {
  const r = redis();
  if (!r) {
    return {
      async limit() {
        return { success: true, remaining: max, reset: Date.now() + windowSecs * 1000 };
      },
    };
  }
  const rl = new Ratelimit({
    redis: r,
    prefix,
    limiter: Ratelimit.slidingWindow(max, `${windowSecs} s`),
    analytics: false,
  });
  return { limit: (key) => rl.limit(key) };
}

export const loginByEmail = buildLimiter("rl:login:email", 5, 15 * 60);
export const loginByIp = buildLimiter("rl:login:ip", 20, 15 * 60);
