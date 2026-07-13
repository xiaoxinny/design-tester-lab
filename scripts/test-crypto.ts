/**
 * Tests for src/lib/crypto.ts (AES-256-GCM with AAD).
 *
 * Pattern follows scripts/test-env.ts: standalone, run via `tsx`,
 * pure-Node, no test framework. Output is "OK: ..." / "FAIL: ..." lines.
 */
import { encrypt, decrypt, CryptoError, CRYPTO_CONSTANTS } from '../src/lib/crypto';

const validKey = Buffer.alloc(32, 0x42); // 32 bytes of 0x42
const otherKey = Buffer.alloc(32, 0x99); // distinct from validKey
const shortKey = Buffer.alloc(16, 0x01); // AES-128 not AES-256, should be rejected

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

function expectThrow(label: string, fn: () => unknown, expectedFragment: string): void {
  try {
    fn();
    fail_(label, `expected throw containing "${expectedFragment}", got nothing`);
  } catch (e) {
    if (e instanceof CryptoError && e.message.includes(expectedFragment)) {
      ok(label, `"${e.message}"`);
    } else {
      fail_(label, `wrong error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

function expectOk(label: string, fn: () => unknown): void {
  try {
    const result = fn();
    ok(label, JSON.stringify(result).slice(0, 80));
  } catch (e) {
    fail_(label, `unexpected throw: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// === Round-trip tests ===

expectOk('round-trip: simple ASCII plaintext', () => {
  const r = encrypt({ key: validKey, plaintext: 'sk-abc123', userId: 'u1', credentialId: 'c1' });
  const pt = decrypt({ key: validKey, stored: r.stored, userId: 'u1', credentialId: 'c1' });
  if (pt !== 'sk-abc123') throw new Error(`got ${pt}`);
  return { storedLen: r.stored.length };
});

expectOk('round-trip: long plaintext (10 KB)', () => {
  const pt = 'A'.repeat(10_000);
  const r = encrypt({ key: validKey, plaintext: pt, userId: 'u1', credentialId: 'c1' });
  const out = decrypt({ key: validKey, stored: r.stored, userId: 'u1', credentialId: 'c1' });
  if (out !== pt) throw new Error('mismatch');
  return { len: out.length };
});

expectOk('round-trip: unicode + newlines', () => {
  const pt = 'pässwörd\nline2\t中文';
  const r = encrypt({ key: validKey, plaintext: pt, userId: 'u1', credentialId: 'c1' });
  const out = decrypt({ key: validKey, stored: r.stored, userId: 'u1', credentialId: 'c1' });
  if (out !== pt) throw new Error('mismatch');
  return { ok: true };
});

expectOk('round-trip: each invocation produces a different IV (probabilistic)', () => {
  const r1 = encrypt({ key: validKey, plaintext: 'same', userId: 'u1', credentialId: 'c1' });
  const r2 = encrypt({ key: validKey, plaintext: 'same', userId: 'u1', credentialId: 'c1' });
  if (r1.stored === r2.stored) throw new Error('two encrypts of same plaintext produced same stored output (IV reuse?)');
  return { iv1: r1.ivB64, iv2: r2.ivB64 };
});

// === Storage format ===

expectOk('stored format is <iv>:<ct>:<tag> with 3 colon-separated base64 parts', () => {
  const r = encrypt({ key: validKey, plaintext: 'x', userId: 'u1', credentialId: 'c1' });
  const parts = r.stored.split(':');
  if (parts.length !== 3) throw new Error(`expected 3 parts, got ${parts.length}`);
  if (parts[0]!.length === 0 || parts[1]!.length === 0 || parts[2]!.length === 0) {
    throw new Error('one or more parts are empty');
  }
  // IV is 12 bytes → 16 base64 chars (12 * 4/3 = 16, no padding needed for 12)
  if (parts[0]!.length !== 16) throw new Error(`iv length should be 16 base64 chars, got ${parts[0]!.length}`);
  return { parts: parts.length };
});

expectOk('IV is 12 bytes (96 bits, GCM standard)', () => {
  if (CRYPTO_CONSTANTS.IV_BYTES !== 12) {
    throw new Error(`IV_BYTES is ${CRYPTO_CONSTANTS.IV_BYTES}, expected 12`);
  }
  if (CRYPTO_CONSTANTS.KEY_BYTES !== 32) {
    throw new Error(`KEY_BYTES is ${CRYPTO_CONSTANTS.KEY_BYTES}, expected 32`);
  }
  if (CRYPTO_CONSTANTS.AUTH_TAG_BYTES !== 16) {
    throw new Error(`AUTH_TAG_BYTES is ${CRYPTO_CONSTANTS.AUTH_TAG_BYTES}, expected 16`);
  }
  return { constants: 'ok' };
});

// === Wrong-key rejection ===

expectThrow(
  'wrong key fails decryption',
  () => {
    const r = encrypt({ key: validKey, plaintext: 'secret', userId: 'u1', credentialId: 'c1' });
    decrypt({ key: otherKey, stored: r.stored, userId: 'u1', credentialId: 'c1' });
  },
  'decryption failed',
);

expectThrow(
  'modified ciphertext fails auth tag',
  () => {
    const r = encrypt({ key: validKey, plaintext: 'secret', userId: 'u1', credentialId: 'c1' });
    // Flip a bit in the ciphertext portion
    const parts = r.stored.split(':');
    const tampered = `${parts[0]}:AAAA${parts[1]!.slice(4)}:${parts[2]}`;
    decrypt({ key: validKey, stored: tampered, userId: 'u1', credentialId: 'c1' });
  },
  'decryption failed',
);

expectThrow(
  'truncated auth tag fails as malformed (caught at format check, before decrypt)',
  () => {
    const r = encrypt({ key: validKey, plaintext: 'secret', userId: 'u1', credentialId: 'c1' });
    const parts = r.stored.split(':');
    // Trim 4 chars off the tag (1 byte). The remaining 12 base64 chars decode to
    // 9 bytes, which is < 16-byte AUTH_TAG_BYTES, so the format check rejects.
    const truncated = `${parts[0]}:${parts[1]}:${parts[2]!.slice(0, -4)}`;
    decrypt({ key: validKey, stored: truncated, userId: 'u1', credentialId: 'c1' });
  },
  'malformed',
);

// === AAD binding ===

expectThrow(
  'wrong userId fails (AAD binding)',
  () => {
    const r = encrypt({ key: validKey, plaintext: 'secret', userId: 'u1', credentialId: 'c1' });
    decrypt({ key: validKey, stored: r.stored, userId: 'u2', credentialId: 'c1' });
  },
  'decryption failed',
);

expectThrow(
  'wrong credentialId fails (AAD binding)',
  () => {
    const r = encrypt({ key: validKey, plaintext: 'secret', userId: 'u1', credentialId: 'c1' });
    decrypt({ key: validKey, stored: r.stored, userId: 'u1', credentialId: 'c2' });
  },
  'decryption failed',
);

expectOk('swapping ciphertext between rows is detectable', () => {
  // Two rows with different (userId, credentialId) pairs
  const r1 = encrypt({ key: validKey, plaintext: 'row1', userId: 'u1', credentialId: 'c1' });
  const r2 = encrypt({ key: validKey, plaintext: 'row2', userId: 'u2', credentialId: 'c2' });
  // Try to decrypt r1 with u2/c2 (swapped) — should fail
  let threw = false;
  try {
    decrypt({ key: validKey, stored: r1.stored, userId: 'u2', credentialId: 'c2' });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('AAD swap did not fail');
  return { detected: true };
});

// === Malformed inputs ===

expectThrow(
  'malformed stored (only 2 parts) fails',
  () => {
    decrypt({ key: validKey, stored: 'foo:bar', userId: 'u1', credentialId: 'c1' });
  },
  'malformed',
);

expectThrow(
  'malformed stored (4 parts) fails',
  () => {
    decrypt({ key: validKey, stored: 'a:b:c:d', userId: 'u1', credentialId: 'c1' });
  },
  'malformed',
);

expectThrow(
  'empty stored fails',
  () => {
    decrypt({ key: validKey, stored: '', userId: 'u1', credentialId: 'c1' });
  },
  'malformed',
);

expectThrow(
  'short key rejected at encrypt time',
  () => {
    encrypt({ key: shortKey, plaintext: 'x', userId: 'u1', credentialId: 'c1' });
  },
  '32 bytes',
);

expectThrow(
  'empty plaintext rejected at encrypt time',
  () => {
    encrypt({ key: validKey, plaintext: '', userId: 'u1', credentialId: 'c1' });
  },
  'plaintext must be non-empty',
);

expectThrow(
  'empty userId rejected at encrypt time (AAD must bind)',
  () => {
    encrypt({ key: validKey, plaintext: 'x', userId: '', credentialId: 'c1' });
  },
  'AAD binding',
);

expectThrow(
  'empty credentialId rejected at encrypt time (AAD must bind)',
  () => {
    encrypt({ key: validKey, plaintext: 'x', userId: 'u1', credentialId: '' });
  },
  'AAD binding',
);

console.log('');
console.log(`Results: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
