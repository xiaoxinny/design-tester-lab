/**
 * HTTP helper for the rate limiter.
 *
 *   - extractClientIp(req): gets the caller's IP, falling back to a literal
 *     'unknown' if neither x-forwarded-for nor x-real-ip is present.
 *   - applyRateLimit(req, routeKey, key?): checks the per-route limiter and
 *     returns either a 429 NextResponse (with Retry-After and X-RateLimit-*
 *     headers) or null (if the request is allowed). When `key` is omitted
 *     the client IP is used.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRouteLimiter, RateLimitResult } from './rate-limit';

export function extractClientIp(req: NextRequest): string {
  // X-Forwarded-For: client, proxy1, proxy2 -- the leftmost is the original
  // client. We take it; for a public deployment the proxy strips the rest.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

/**
 * Apply a per-route rate limit. Returns null if allowed, or a 429 response
 * if denied. The 429 response carries the standard Retry-After header (in
 * seconds) plus X-RateLimit-Limit and X-RateLimit-Remaining for clients
 * that want to back off.
 */
export function applyRateLimit(
  req: NextRequest,
  routeKey: string,
  key?: string,
): NextResponse | null {
  const limiter = getRouteLimiter(routeKey);
  const effectiveKey = key ?? extractClientIp(req);
  const result: RateLimitResult = limiter.check(routeKey, effectiveKey);
  if (result.allowed) return null;
  const retryAfterSec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return NextResponse.json(
    { error: 'rate limit exceeded', retryAfterMs: result.retryAfterMs },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}
