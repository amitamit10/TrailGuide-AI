import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const aiRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "trailguide:ai",
  analytics: false,
});

// Per-IP limiter for unauthenticated public routes that call billed third-party
// APIs (photo proxy, visa, weather). Protects external quotas from anonymous abuse.
export const publicRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "trailguide:public",
  analytics: false,
});

/** Best-effort client IP from proxy headers, falling back to a constant bucket. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}
