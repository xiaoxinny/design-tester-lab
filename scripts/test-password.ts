/**
 * Tests for src/lib/password.ts (argon2id wrapper).
 *
 * Pattern follows scripts/test-env.ts: standalone, run via `tsx`,
 * pure-Node, no test framework.
 *
 * Argon2 hashes are slow (200ms+ per call at OWASP-min-A) so this suite
 * runs fewer cases than test-crypto.ts.
 */
import {
  hashPassword,
  verifyPassword,
  upgradeHashIfNeeded,
  PasswordError,
  MIN_PASSWORD_LENGTH,
} from '../src/lib/password';

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

function expectThrow(label: string, fn: () => unknown, expectedFragment: string): Promise<void> {
  try {
    const r = fn();
    if (r instanceof Promise) {
      return r.then(
        () => {
          fail_(label, 'expected throw, got resolved promise');
        },
        (e) => {
          if (e instanceof PasswordError && e.message.includes(expectedFragment)) {
            ok(label, `"${e.message}"`);
          } else {
            fail_(label, `wrong error: ${e instanceof Error ? e.message : String(e)}`);
          }
        },
      );
    }
    fail_(label, `expected throw, got ${r}`);
    return Promise.resolve();
  } catch (e) {
    if (e instanceof PasswordError && e.message.includes(expectedFragment)) {
      ok(label, `"${e.message}"`);
    } else {
      fail_(label, `wrong error: ${e instanceof Error ? e.message : String(e)}`);
    }
    return Promise.resolve();
  }
}

function expectOk(label: string, fn: () => unknown): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(
      (r) => {
        if (r instanceof Promise) return r;
        ok(label, JSON.stringify(r).slice(0, 80));
        return undefined;
      },
      (e) => {
        fail_(label, `unexpected throw: ${e instanceof Error ? e.message : String(e)}`);
      },
    )
    .then((p) => {
      if (p instanceof Promise) {
        return p.then(
          (r) => ok(label, JSON.stringify(r).slice(0, 80)),
          (e) => fail_(label, `unexpected throw: ${e instanceof Error ? e.message : String(e)}`),
        );
      }
      return undefined;
    });
}

async function main(): Promise<void> {
  // === Format checks ===

  const h1 = await hashPassword('correct-horse-battery-staple');
  if (!h1.startsWith('$argon2id$')) {
    fail_('hash format starts with $argon2id$', `got: ${h1.slice(0, 30)}`);
  } else if (!h1.includes(`m=${19456}`) || !h1.includes(`t=${2}`) || !h1.includes(`p=${1}`)) {
    fail_('hash format includes OWASP-min-A params (m=19456, t=2, p=1)', `got: ${h1}`);
  } else {
    ok('hash format starts with $argon2id$ and embeds OWASP-min-A params', h1.slice(0, 50) + '...');
  }

  const h2 = await hashPassword('correct-horse-battery-staple', 'minB');
  if (!h2.includes('m=7168') || !h2.includes('t=5')) {
    fail_('minB hash uses OWASP-min-B params (m=7168, t=5)', `got: ${h2}`);
  } else {
    ok('minB hash uses OWASP-min-B params (m=7168, t=5)', h2.slice(0, 50) + '...');
  }

  // === Round-trip: verify accepts correct password ===

  if ((await verifyPassword(h1, 'correct-horse-battery-staple')) !== true) {
    fail_('verify accepts the password used to hash', 'verify returned false');
  } else {
    ok('verify accepts the password used to hash', 'verified=true');
  }

  // === Round-trip: verify rejects wrong password ===

  if ((await verifyPassword(h1, 'wrong-password')) !== false) {
    fail_('verify rejects a different password', 'verify returned true');
  } else {
    ok('verify rejects a different password', 'verified=false');
  }

  // === Round-trip: same password, different hashes (probabilistic) ===

  const h3 = await hashPassword('same-password-different-call');
  const h4 = await hashPassword('same-password-different-call');
  if (h3 === h4) {
    fail_('two hashes of the same password are different (random salt)', 'both equal');
  } else {
    ok('two hashes of the same password are different (random salt)', `${h3.slice(0, 30)}... vs ${h4.slice(0, 30)}...`);
  }
  if ((await verifyPassword(h3, 'same-password-different-call')) !== true) {
    fail_('verify still works across two different hashes of the same password', 'verify false');
  } else {
    ok('verify still works across two different hashes of the same password', 'verified=true');
  }

  // === Length validation ===

  await expectThrow(
    `hash rejects passwords shorter than ${MIN_PASSWORD_LENGTH} chars`,
    () => hashPassword('short'),
    `${MIN_PASSWORD_LENGTH} characters`,
  );

  // === Malformed input ===

  await expectThrow(
    'verify rejects a stored hash that is not an argon2id PHC string',
    () => verifyPassword('not-a-real-argon2id-hash', 'whatever'),
    'not an argon2id',
  );

  // === upgradeHashIfNeeded ===

  // New hash at the current level -> no upgrade needed
  const u1 = await upgradeHashIfNeeded(h1, 'correct-horse-battery-staple', 'minA');
  if (u1 !== null) {
    fail_('upgradeHashIfNeeded returns null for hash already at the target level', `got: ${u1}`);
  } else {
    ok('upgradeHashIfNeeded returns null for hash already at the target level', 'null');
  }

  // minA hash, asked to bring up to minB -> upgrade
  const u2 = await upgradeHashIfNeeded(h1, 'correct-horse-battery-staple', 'minB');
  if (u2 === null || !u2.includes('m=7168') || !u2.includes('t=5')) {
    fail_('upgradeHashIfNeeded returns a minB hash when target is minB and stored is minA', `got: ${u2}`);
  } else {
    ok('upgradeHashIfNeeded returns a minB hash when target is minB and stored is minA', u2.slice(0, 40) + '...');
  }

  // Verify the upgraded hash also validates
  if (u2 && (await verifyPassword(u2, 'correct-horse-battery-staple')) !== true) {
    fail_('upgraded hash validates the same password', 'verify returned false on upgrade');
  } else {
    ok('upgraded hash validates the same password', 'verified=true');
  }

  // Malformed stored hash -> null (no upgrade possible)
  const u3 = await upgradeHashIfNeeded('not-a-real-hash', 'whatever', 'minA');
  if (u3 !== null) {
    fail_('upgradeHashIfNeeded returns null for malformed stored hash', `got: ${u3}`);
  } else {
    ok('upgradeHashIfNeeded returns null for malformed stored hash', 'null');
  }

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('UNEXPECTED:', e);
  process.exit(1);
});
