/**
 * Tests for src/lib/rate-limit.ts.
 */
import { createRateLimiterWithClock, createRateLimiter, _resetAllRateLimiters, getRouteRateLimit } from '../src/lib/rate-limit';

let pass = 0;
let fail = 0;

function ok(label: string, detail: string): void {
  console.log(`OK:   ${label} -- ${detail}`);
  pass++;
}

function fail_(label: string, detail: string): void {
  console.log(`FAIL: ${label} -- ${detail}`);
  fail++;
}

function main(): void {
  // === Basic: bucket allows capacity requests, denies the (capacity+1)th ===

  let clockMs = 1_000_000;
  const tick = (ms: number) => { clockMs += ms; };
  const limiter = createRateLimiterWithClock(
    { capacity: 5, refillPerSec: 1 },
    () => clockMs,
  );

  // First 5 requests allowed.
  for (let i = 0; i < 5; i++) {
    const r = limiter.check('test', 'key1');
    if (!r.allowed) {
      fail_((`request ${i + 1} allowed (capacity 5)`), `denied, retryAfter=${r.retryAfterMs}`);
      return;
    }
  }
  ok('first 5 requests allowed (capacity 5)', '5/5 allowed');

  // 6th request denied.
  const denied = limiter.check('test', 'key1');
  if (denied.allowed) {
    fail_('6th request denied', `allowed with remaining=${denied.remaining}`);
  } else if (denied.retryAfterMs <= 0) {
    fail_('6th request has retryAfterMs > 0', `got: ${denied.retryAfterMs}`);
  } else {
    ok('6th request denied with retryAfterMs', `${denied.retryAfterMs}ms`);
  }

  // === Refill: after 1 second, 1 token back ===

  tick(1000);
  const after1s = limiter.check('test', 'key1');
  if (!after1s.allowed) {
    fail_('after 1s, 1 token back', 'denied');
  } else {
    ok('after 1s, 1 token back', 'allowed');
  }

  // Immediately after, denied again.
  const after1sImmediate = limiter.check('test', 'key1');
  if (after1sImmediate.allowed) {
    fail_('after 1s+immediate, denied', `allowed with remaining=${after1sImmediate.remaining}`);
  } else {
    ok('after 1s+immediate, denied', 'denied');
  }

  // === Refill: after 5s, full bucket back ===

  tick(5000);
  for (let i = 0; i < 5; i++) {
    const r = limiter.check('test', 'key1');
    if (!r.allowed) {
      fail_(`after 5s+${i}, allowed`, 'denied');
      return;
    }
  }
  ok('after 5s, full bucket refilled', '5/5 allowed');

  // === Isolation: different keys have independent buckets ===

  const otherKey = limiter.check('test', 'key2');
  if (!otherKey.allowed) {
    fail_('different key is independent', 'denied');
  } else {
    ok('different key is independent', 'allowed');
  }

  // === Isolation: different routes have independent buckets ===

  const otherRoute = limiter.check('other-route', 'key1');
  if (!otherRoute.allowed) {
    fail_('different route is independent', 'denied');
  } else {
    ok('different route is independent', 'allowed');
  }

  // === Burst: capacity is enforced ===

  tick(60_000); // long pause
  const burstLimiter = createRateLimiterWithClock(
    { capacity: 3, refillPerSec: 0.1 }, // very slow refill
    () => clockMs,
  );
  for (let i = 0; i < 3; i++) {
    const r = burstLimiter.check('burst', 'k');
    if (!r.allowed) {
      fail_(`burst ${i + 1} allowed (cap 3)`, 'denied');
      return;
    }
  }
  const burstDenied = burstLimiter.check('burst', 'k');
  if (burstDenied.allowed) {
    fail_('burst 4th denied', 'allowed');
  } else {
    ok('burst 4th denied (cap 3 + slow refill)', 'denied');
  }

  // === result shape: limit, remaining, retryAfterMs ===

  const r = burstLimiter.check('burst', 'k');
  if (r.limit !== 3) {
    fail_('result.limit reflects capacity', `got: ${r.limit}`);
  } else if (r.remaining !== 0) {
    fail_('result.remaining is 0 when denied', `got: ${r.remaining}`);
  } else if (r.retryAfterMs < 1000) {
    fail_('result.retryAfterMs is large for slow refill', `got: ${r.retryAfterMs}`);
  } else {
    ok('result shape is correct', `limit=${r.limit} remaining=${r.remaining} retryAfterMs=${r.retryAfterMs}`);
  }

  // === size + reset ===

  if (limiter.size() < 2) {
    fail_('size() reports tracked buckets', `got: ${limiter.size()}`);
  } else {
    ok('size() reports tracked buckets', `${limiter.size()}`);
  }
  limiter.reset();
  if (limiter.size() !== 0) {
    fail_('reset() clears all buckets', `got: ${limiter.size()}`);
  } else {
    ok('reset() clears all buckets', '0');
  }

  // === High refill rate: refills to capacity quickly ===

  const fastLimiter = createRateLimiterWithClock(
    { capacity: 10, refillPerSec: 100 }, // 100 tokens/sec
    () => clockMs,
  );
  for (let i = 0; i < 10; i++) fastLimiter.check('fast', 'k');
  tick(100); // 100ms = 10 tokens at 100/sec
  for (let i = 0; i < 10; i++) {
    const r = fastLimiter.check('fast', 'k');
    if (!r.allowed) {
      fail_(`fast ${i + 1} allowed after 100ms`, 'denied');
      return;
    }
  }
  ok('high refill rate works', '10/10 allowed after 100ms');

  // === createRateLimiter (with real Date.now) basic smoke ===

  const realLimiter = createRateLimiter({ capacity: 2, refillPerSec: 1 });
  if (!realLimiter.check('real', 'k').allowed) {
    fail_('createRateLimiter (real clock) basic', 'denied');
  } else if (!realLimiter.check('real', 'k').allowed) {
    fail_('createRateLimiter (real clock) basic 2', 'denied');
  } else if (realLimiter.check('real', 'k').allowed) {
    fail_('createRateLimiter (real clock) deny 3rd', 'allowed');
  } else {
    ok('createRateLimiter (real clock) works', '2 allowed, 3rd denied');
  }

  // === auth.precheck route is in the table ===

  // The precheck bucket is the per-IP, pre-auth bucket used on every
  // protected route. It must exist in the route table so the rate-limit
  // primitive doesn't throw at first request.
  let precheckErr: Error | null = null;
  let precheckConfig: { capacity: number; refillPerSec: number } | null = null;
  try {
    const r = getRouteRateLimit('auth.precheck');
    precheckConfig = { capacity: r.capacity, refillPerSec: r.refillPerSec };
  } catch (e) {
    precheckErr = e as Error;
  }
  if (precheckErr) {
    fail_('auth.precheck is in the route table', `threw: ${precheckErr.message}`);
  } else if (!precheckConfig || precheckConfig.capacity < 1 || precheckConfig.refillPerSec <= 0) {
    fail_('auth.precheck has sane config', `got: ${JSON.stringify(precheckConfig)}`);
  } else {
    ok('auth.precheck is in the route table with sane config', JSON.stringify(precheckConfig));
  }

  // === _resetAllRateLimiters ===

  _resetAllRateLimiters();
  ok('_resetAllRateLimiters is callable', 'no-throw');

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
