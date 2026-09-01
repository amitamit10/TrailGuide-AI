import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting degrades to a no-op when Upstash is not configured.
 *
 * `Redis.fromEnv()` happily constructs a client with an undefined URL and only
 * throws ("Failed to parse URL from /pipeline") when `.limit()` is awaited —
 * i.e. at request time, as a 500 on every rate-limited route. Building the
 * limiter only when both env vars are present keeps local dev and any
 * misconfigured environment serving traffic instead of failing closed.
 */
const isConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

type Limiter = { limit(identifier: string): Promise<{ success: boolean }> };

const allowAll: Limiter = { limit: async () => ({ success: true }) };

function createLimiter(tokens: number, prefix: string): Limiter {
  if (!isConfigured) return allowAll;

  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(tokens, "1 m"),
    prefix,
    analytics: false,
  });

  // Redis being unreachable must not take the route down with it.
  return {
    async limit(identifier: string) {
      try {
        return await ratelimit.limit(identifier);
      } catch {
        return { success: true };
      }
    },
  };
}

export const aiRatelimit = createLimiter(10, "trailguide:ai");

// Per-IP limiter for unauthenticated public routes that call billed third-party
// APIs (photo proxy, visa, weather). Protects external quotas from anonymous abuse.
export const publicRatelimit = createLimiter(30, "trailguide:public");

/** Best-effort client IP from proxy headers, falling back to a constant bucket. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}
