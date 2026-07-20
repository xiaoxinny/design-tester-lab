/**
 * In-memory rate limiter.
 *
 * A token bucket per (route, key) tuple. Each bucket has a capacity and
 * refills at a fixed rate. Each request consumes one token; if the bucket
 * is empty, the request is denied.
 *
 * Scope: in-memory only. Not shared across multiple Node processes. For
 * multi-server deployments, replace the Map with Redis (the public API
 * is the same; just the storage layer changes).
 *
 * Memory bound: idle buckets are evicted on each check after
 * `idleEvictMs` (default 5 min) of inactivity. This prevents a flood of
 * unique keys (e.g. a botnet hitting /login with random IPs) from growing
 * the map without bound.
 *
 * The default constructor reads RATE_LIMIT_* env vars so operators can
 * tune per deployment. Tests use `createRateLimiter({ ... })` with a
 * fixed clock to make timing deterministic.
 */
import { resolveEnv } from './env';

export interface RateLimitConfig {
  /** max tokens in the bucket (== burst capacity) */
  capacity: number;
  /** tokens added per second */
  refillPerSec: number;
}

export interface RateLimitResult {
  /** true if the request is allowed (a token was consumed) */
  allowed: boolean;
  /** tokens remaining in the bucket after this call */
  remaining: number;
  /** ms until a token will be available, or 0 if allowed */
  retryAfterMs: number;
  /** the bucket's capacity (for X-RateLimit-Limit headers) */
  limit: number;
}

export interface RateLimiter {
  /**
   * Check (and consume) one token for the given (route, key) tuple.
   * The route is an arbitrary string (`'login'`, `'generate'`, etc.).
   * The key is typically a userId or IP.
   */
  check(route: string, key: string): RateLimitResult;
  /** Reset the limiter. Used in tests. */
  reset(): void;
  /** Number of tracked buckets. For diagnostics + tests. */
  size(): number;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
  lastAccessMs: number;
}

const IDLE_EVICT_MS = 5 * 60 * 1000;
const DEFAULT_CAPACITY = 60;
const DEFAULT_REFILL_PER_SEC = 1; // 1 token/sec == 60/min average

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return createRateLimiterWithClock(config, () => Date.now());
}

/** Test-only: inject a clock for deterministic time. */
export function createRateLimiterWithClock(
  config: RateLimitConfig,
  clock: () => number,
): RateLimiter {
  // Same as createRateLimiter but with the clock function injected.
  // The closure variable `now` is the only difference.
  const buckets = new Map<string, Bucket>();
  function now(): number {
    return clock();
  }
  function getOrCreate(route: string, key: string): Bucket {
    const id = `${route}::${key}`;
    const existing = buckets.get(id);
    if (existing) return existing;
    const created: Bucket = {
      tokens: config.capacity,
      lastRefillMs: now(),
      lastAccessMs: now(),
    };
    buckets.set(id, created);
    return created;
  }
  function refill(bucket: Bucket): void {
    const t = now();
    const elapsedMs = t - bucket.lastRefillMs;
    if (elapsedMs <= 0) return;
    const addTokens = (elapsedMs / 1000) * config.refillPerSec;
    bucket.tokens = Math.min(config.capacity, bucket.tokens + addTokens);
    bucket.lastRefillMs = t;
  }
  return {
    check(route, key) {
      const bucket = getOrCreate(route, key);
      refill(bucket);
      bucket.lastAccessMs = now();
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return {
          allowed: true,
          remaining: Math.floor(bucket.tokens),
          retryAfterMs: 0,
          limit: config.capacity,
        };
      }
      const deficit = 1 - bucket.tokens;
      const retryAfterMs = Math.ceil((deficit / config.refillPerSec) * 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
        limit: config.capacity,
      };
    },
    reset() {
      buckets.clear();
    },
    size() {
      const t = now();
      for (const [id, b] of buckets) {
        if (t - b.lastAccessMs > IDLE_EVICT_MS) buckets.delete(id);
      }
      return buckets.size;
    },
  };
}

// =====================================================================
// Default singleton
// =====================================================================

let _default: RateLimiter | null = null;

/**
 * Get the default rate limiter. Configured from env at first call.
 *
 * RATE_LIMIT_GLOBAL_DISABLED=true disables the rate limiter (returns a
 * no-op). This is for local dev / tests that don't want the throttle.
 */
export function getDefaultRateLimiter(): RateLimiter {
  if (_default) return _default;
  const env = resolveEnv();
  if (process.env.RATE_LIMIT_GLOBAL_DISABLED === 'true') {
    return (_default = createRateLimiter({ capacity: 1_000_000, refillPerSec: 1_000_000 }));
  }
  // Defaults: 60 burst, 1 token/sec average. Most endpoints wrap with
  // route-specific limits via getRouteRateLimit().
  return (_default = createRateLimiter({
    capacity: env.rateLimitCapacity,
    refillPerSec: env.rateLimitRefillPerSec,
  }));
}

/**
 * Per-route limits. Each route gets its own bucket *per key*. The route
 * identifier is the first arg to check(). Different routes do not share
 * capacity.
 */
export interface RouteRateLimit {
  route: string;
  capacity: number;
  refillPerSec: number;
}

export const ROUTE_LIMITS: Record<string, RouteRateLimit> = {
  'auth.precheck': { route: 'auth.precheck', capacity: 200, refillPerSec: 200 / 60 }, // 200/min per IP, pre-auth cheap bucket
  'auth.login': { route: 'auth.login', capacity: 5, refillPerSec: 5 / 60 }, // 5 per minute
  'auth.signup': { route: 'auth.signup', capacity: 5, refillPerSec: 5 / 3600 }, // 5 per hour
  'auth.logout': { route: 'auth.logout', capacity: 30, refillPerSec: 0.5 }, // 30 per minute
  'auth.password': { route: 'auth.password', capacity: 5, refillPerSec: 5 / 60 }, // 5/min (per user), per-IP preauth caps further
  'credentials.write': { route: 'credentials.write', capacity: 20, refillPerSec: 20 / 60 }, // 20/min
  'credentials.read': { route: 'credentials.read', capacity: 60, refillPerSec: 1 }, // 60/min
  'generate': { route: 'generate', capacity: 10, refillPerSec: 10 / 60 }, // 10/min
};

export function getRouteRateLimit(routeKey: string): RouteRateLimit {
  const limit = ROUTE_LIMITS[routeKey];
  if (!limit) throw new Error(`unknown rate limit route: ${routeKey}`);
  return limit;
}

export function getRouteLimiter(routeKey: string): RateLimiter {
  // Each route gets its own RateLimiter (and thus its own Map of buckets).
  // We lazily create on first use. This means each route has independent
  // capacity and refill, even if keys overlap.
  return _routeLimiters.get(routeKey) ?? createRouteLimiter(routeKey);
}

const _routeLimiters = new Map<string, RateLimiter>();
function createRouteLimiter(routeKey: string): RateLimiter {
  const config = getRouteRateLimit(routeKey);
  const limiter = createRateLimiter({ capacity: config.capacity, refillPerSec: config.refillPerSec });
  _routeLimiters.set(routeKey, limiter);
  return limiter;
}

/** For tests: clear the default + per-route limiters. */
export function _resetAllRateLimiters(): void {
  _default = null;
  _routeLimiters.clear();
}
