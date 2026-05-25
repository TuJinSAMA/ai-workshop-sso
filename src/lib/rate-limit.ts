import { RateLimiterRedis, RateLimiterMemory, type RateLimiterAbstract } from "rate-limiter-flexible";
import { redis } from "./redis";

// Login rate limiting (spec Section 10): email 5/15min, IP 20/15min.
// Uses ioredis-backed sliding window via rate-limiter-flexible.
// Falls back to in-memory limiter when REDIS_URL is unset (local dev).

const useRedis = Boolean(process.env.REDIS_URL);

function build(keyPrefix: string, points: number, durationSecs: number): RateLimiterAbstract {
  if (useRedis) {
    return new RateLimiterRedis({
      storeClient: redis,
      keyPrefix,
      points,
      duration: durationSecs,
      // Block the key for the remainder of the window once exhausted.
      blockDuration: durationSecs,
    });
  }
  return new RateLimiterMemory({ keyPrefix, points, duration: durationSecs });
}

export type RateCheck = {
  success: boolean;
  remaining: number;
  /** Milliseconds until the window resets. */
  resetMs: number;
};

async function consume(limiter: RateLimiterAbstract, key: string): Promise<RateCheck> {
  try {
    const res = await limiter.consume(key, 1);
    return { success: true, remaining: res.remainingPoints, resetMs: res.msBeforeNext };
  } catch (rejection) {
    // RateLimiterRes shape when over the limit.
    const r = rejection as { remainingPoints?: number; msBeforeNext?: number };
    return {
      success: false,
      remaining: r.remainingPoints ?? 0,
      resetMs: r.msBeforeNext ?? 0,
    };
  }
}

const emailLimiter = build("rl:login:email", 5, 15 * 60);
const ipLimiter = build("rl:login:ip", 20, 15 * 60);

export const loginByEmail = { limit: (key: string) => consume(emailLimiter, key) };
export const loginByIp = { limit: (key: string) => consume(ipLimiter, key) };
