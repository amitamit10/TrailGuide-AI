import { timingSafeEqual } from "crypto";

/**
 * Verify a Vercel Cron request's Authorization header against CRON_SECRET using
 * a constant-time comparison. Returns true only when the secret is configured
 * and the bearer token matches exactly.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
