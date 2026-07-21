/**
 * Environment loading + validation.
 *
 * Run once at app boot. Validates required secrets and refuses to start
 * if anything critical is missing or malformed.
 *
 * Why so strict: the app stores BYOK credentials encrypted with ENCRYPTION_KEY.
 * If ENCRYPTION_KEY is wrong, the user's API keys are silently corrupted (or
 * worse, the app silently zero-pads a short key and produces a deceptively
 * weak cipher). The `auth:check-env` npm script lets you verify env wiring
 * before booting the full app.
 */

const ENCRYPTION_KEY_BYTES = 32;

/**
 * Returns true if a HOST value represents a loopback bind target.
 *
 * Unset or empty string is treated as loopback-allowing ONLY when AUTH_DISABLED
 * is also unset. Callers in the AUTH_DISABLED guard handle the combination.
 * Used by the boot-time check that refuses to start the app with auth
 * disabled unless it's bound to a loopback address.
 *
 * Reference: GLM-5.2 code review (2026-07-13), section 1.1.
 */
function isLoopbackBind(host: string | undefined): boolean {
  if (!host || host.trim().length === 0) return false; // unset/empty -> Next.js default 0.0.0.0 -> fail closed
  const h = host.trim().toLowerCase();
  return h === '127.0.0.1' || h === '::1' || h === 'localhost' || h === '0:0:0:0:0:0:0:1';
}

function readEnv(name: string, env: Partial<NodeJS.ProcessEnv> = process.env): string | undefined {
  const v = env[name];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  if (trimmed.length === 0) return undefined;
  // Reject CRLF and other C0 control chars inside the value. Prevents
  // header/log injection if an env value is later interpolated into a
  // header or log line. Spaces, tabs, and printable ASCII are allowed.
  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    throw new EnvValidationError(
      `env var ${name} contains a control character (CR/LF/NUL etc); refusing to start`,
    );
  }
  return trimmed;
}

function readEnvRequired(name: string, env: Partial<NodeJS.ProcessEnv> = process.env): string {
  const v = readEnv(name, env);
  if (v === undefined) {
    throw new EnvValidationError(`missing required env var: ${name}`);
  }
  return v;
}

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

export interface ResolvedEnv {
  mode: 'supabase' | 'postgres' | 'local';
  port: number;

  // Required in both modes
  encryptionKey: Buffer;
  sessionSecret: Uint8Array;

  // Required in Supabase Cloud mode
  supabase: {
    url: string;
    publishableKey: string;
    /** Server-side admin key. Optional — only needed for admin operations. */
    secretKey: string | null;
    dbUrl?: string; // optional; only needed for `db:seed:supabase` migrations
  } | null;

  // Required in direct PostgreSQL mode
  postgres: {
    connectionUrl: string;
  } | null;

  // Required in local mode
  local: {
    databaseUrl: string;
    storageDir: string;
    augmentationsDir: string;
    defaultUser: {
      email: string;
      password: string;
    } | null;
  } | null;

  // Optional
  authDisabled: boolean;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Default bucket capacity for the rate limiter (also configurable per-route). */
  rateLimitCapacity: number;
  /** Default refill rate for the rate limiter (tokens per second). */
  rateLimitRefillPerSec: number;
}

export function isSupabaseMode(env: Partial<NodeJS.ProcessEnv> = process.env): boolean {
  // Detection requires only the client-visible vars (URL + publishable key);
  // SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY are optional admin creds.
  return Boolean(
    readEnv('NEXT_PUBLIC_SUPABASE_URL', env) &&
      (readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', env) || readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', env)),
  );
}

export function detectMode(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): ResolvedEnv['mode'] {
  const onlineMode = readEnv('ONLINE_MODE', env);
  const isOnline = onlineMode === '1' || onlineMode === 'true';

  if (isOnline || isSupabaseMode(env)) {
    if (isSupabaseMode(env)) return 'supabase';
    const dbUrl = readEnv('DATABASE_URL', env);
    if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
      return 'postgres';
    }
    throw new EnvValidationError(
      'ONLINE_MODE is set but no database configured. Set either Supabase vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) or DATABASE_URL with a postgres:// connection string.',
    );
  }
  return 'local';
}

/**
 * Resolve all env vars to a ResolvedEnv.
 *
 * Partial<NodeJS.ProcessEnv> is intentional: @types/node 22 added
 * NODE_ENV as a required field on ProcessEnv, which broke test fixtures
 * that build env objects without it. The runtime validation in
 * readEnvRequired is the safety net; this signature accepts any subset.
 */
export function resolveEnv(env: Partial<NodeJS.ProcessEnv> = process.env): ResolvedEnv {
  const mode = detectMode(env);

  // Validate ENCRYPTION_KEY in both modes
  const encryptionKeyB64 = readEnvRequired('ENCRYPTION_KEY', env);
  let encryptionKey: Buffer;
  try {
    encryptionKey = Buffer.from(encryptionKeyB64, 'base64');
  } catch {
    throw new EnvValidationError('ENCRYPTION_KEY is not valid base64');
  }
  if (encryptionKey.length !== ENCRYPTION_KEY_BYTES) {
    throw new EnvValidationError(
      `ENCRYPTION_KEY must decode to exactly ${ENCRYPTION_KEY_BYTES} bytes (got ${encryptionKey.length}). Generate with: openssl rand -base64 32`,
    );
  }

  // Validate SESSION_SECRET in both modes
  const sessionSecretB64 = readEnvRequired('SESSION_SECRET', env);
  let sessionSecret: Uint8Array;
  try {
    sessionSecret = new Uint8Array(Buffer.from(sessionSecretB64, 'base64'));
  } catch {
    throw new EnvValidationError('SESSION_SECRET is not valid base64');
  }
  if (sessionSecret.length < 32) {
    throw new EnvValidationError(
      `SESSION_SECRET must decode to at least 32 bytes (got ${sessionSecret.length}). Generate with: openssl rand -base64 32`,
    );
  }
  // Per GLM-5.2 review (section 1.2): key separation. Reusing the same
  // 32-byte value for AES-GCM and HMAC violates security-proof assumptions.
  if (Buffer.compare(encryptionKey, Buffer.from(sessionSecret)) === 0) {
    throw new EnvValidationError(
      'ENCRYPTION_KEY and SESSION_SECRET must be different values (key separation required for AES-GCM vs HMAC)',
    );
  }

  const port = parseInt(readEnv('PORT', env) ?? '3030', 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new EnvValidationError(`PORT must be a valid port number (got: ${readEnv('PORT', env)})`);
  }

  const authDisabled = readEnv('AUTH_DISABLED', env) === 'true';

  // AUTH_DISABLED + non-loopback binding = footgun. Per GLM-5.2 review.
  // isLoopbackBind returns true for unset/empty HOST (Next.js binds to 0.0.0.0
  // by default, which is NOT loopback, so unset + AUTH_DISABLED should fail).
  // To override, set the explicit ack env var documented below.
  if (authDisabled && !isLoopbackBind(env['HOST'])) {
    if (env['I_UNDERSTAND_AUTH_IS_DISABLED_AND_I_AM_EXPOSING_MY_NETWORK'] !== 'true') {
      throw new EnvValidationError(
        'AUTH_DISABLED is set but HOST is bound to a non-loopback address. ' +
          'Refusing to start. Either set HOST=127.0.0.1 (or ::1 or localhost), or unset AUTH_DISABLED. ' +
          'If you really need this (you almost certainly do not), set ' +
          'I_UNDERSTAND_AUTH_IS_DISABLED_AND_I_AM_EXPOSING_MY_NETWORK=true as well.',
      );
    }
  }

  if (mode === 'supabase') {
    return {
      mode,
      port,
      encryptionKey,
      sessionSecret,
      supabase: {
        url: readEnvRequired('NEXT_PUBLIC_SUPABASE_URL', env),
        publishableKey: readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', env) || readEnvRequired('NEXT_PUBLIC_SUPABASE_ANON_KEY', env),
        // Accept either the legacy SUPABASE_SERVICE_ROLE_KEY or the new
        // SUPABASE_SECRET_KEY name; optional — only needed for admin operations.
        secretKey:
          readEnv('SUPABASE_SERVICE_ROLE_KEY', env) ??
          readEnv('SUPABASE_SECRET_KEY', env) ??
          null,
        dbUrl: readEnv('SUPABASE_DB_URL', env),
      },
      postgres: null,
      local: null,
      authDisabled,
      logLevel: (readEnv('LOG_LEVEL', env) as ResolvedEnv['logLevel']) ?? 'info',
      rateLimitCapacity: parseIntPositive(readEnv('RATE_LIMIT_CAPACITY', env) ?? '60', env, 'RATE_LIMIT_CAPACITY'),
      rateLimitRefillPerSec: parseNumberPositive(readEnv('RATE_LIMIT_REFILL_PER_SEC', env) ?? '1', env, 'RATE_LIMIT_REFILL_PER_SEC'),
    };
  }

  if (mode === 'postgres') {
    return {
      mode,
      port,
      encryptionKey,
      sessionSecret,
      supabase: null,
      postgres: { connectionUrl: readEnvRequired('DATABASE_URL', env) },
      local: null,
      authDisabled,
      logLevel: (readEnv('LOG_LEVEL', env) as ResolvedEnv['logLevel']) ?? 'info',
      rateLimitCapacity: parseIntPositive(readEnv('RATE_LIMIT_CAPACITY', env) ?? '60', env, 'RATE_LIMIT_CAPACITY'),
      rateLimitRefillPerSec: parseNumberPositive(readEnv('RATE_LIMIT_REFILL_PER_SEC', env) ?? '1', env, 'RATE_LIMIT_REFILL_PER_SEC'),
    };
  }

  // Local mode
  const localUserEmail = readEnv('LOCAL_DEFAULT_USER_EMAIL', env);
  const localUserPassword = readEnv('LOCAL_DEFAULT_USER_PASSWORD', env);
  type DefaultUser = NonNullable<NonNullable<ResolvedEnv['local']>['defaultUser']>;
  let defaultUser: DefaultUser | null = null;
  if (localUserEmail && localUserPassword) {
    // Basic shape validation; full check happens at user-creation time.
    if (!localUserEmail.includes('@')) {
      throw new EnvValidationError(
        `LOCAL_DEFAULT_USER_EMAIL must be an email address (got: "${localUserEmail}")`,
      );
    }
    if (localUserPassword.length < 8) {
      throw new EnvValidationError(
        `LOCAL_DEFAULT_USER_PASSWORD must be at least 8 characters (got ${localUserPassword.length})`,
      );
    }
    defaultUser = { email: localUserEmail, password: localUserPassword };
  } else if (localUserEmail || localUserPassword) {
    // Only one set -> treat as missing both
    defaultUser = null;
  }

  return {
    mode,
    port,
    encryptionKey,
    sessionSecret,
    supabase: null,
    postgres: null,
    local: {
      databaseUrl: readEnv('DATABASE_URL', env) ?? './data/design-tester-lab.db',
      storageDir: readEnv('STORAGE_DIR', env) ?? './data/storage',
      augmentationsDir: readEnv('AUGMENTATIONS_DIR', env) ?? './content/augmentations',
      defaultUser,
    },
    authDisabled,
    logLevel: (readEnv('LOG_LEVEL', env) as ResolvedEnv['logLevel']) ?? 'info',
    rateLimitCapacity: parseIntPositive(readEnv('RATE_LIMIT_CAPACITY', env) ?? '60', env, 'RATE_LIMIT_CAPACITY'),
    rateLimitRefillPerSec: parseNumberPositive(readEnv('RATE_LIMIT_REFILL_PER_SEC', env) ?? '1', env, 'RATE_LIMIT_REFILL_PER_SEC'),
  };
}

function parseIntPositive(value: string, env: Partial<NodeJS.ProcessEnv>, name: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1) {
    throw new EnvValidationError(`${name} must be a positive integer (got: "${value}")`);
  }
  return n;
}

function parseNumberPositive(value: string, env: Partial<NodeJS.ProcessEnv>, name: string): number {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) {
    throw new EnvValidationError(`${name} must be a non-negative number (got: "${value}")`);
  }
  return n;
}

/**
 * Cached env resolution. Resolved on first access, then memoized.
 *
 * Use `getEnv()` everywhere instead of touching `process.env` directly.
 * Throws on first call if env is invalid, but throws on the same conditions
 * every subsequent call -- so you only need to handle it once in startup.
 */
let cached: ResolvedEnv | null = null;
export function getEnv(): ResolvedEnv {
  if (cached === null) {
    cached = resolveEnv();
    if (cached.mode === 'local' && !cached.authDisabled && cached.local?.defaultUser === null) {
      // In local mode with auth enabled, you need to set the default user
      // OR the login page will refuse to render. Don't throw here -- let the
      // login page render the setup instructions instead.
    }
  }
  return cached;
}

/**
 * Test-only: reset the cached env so tests can re-evaluate after mutating process.env.
 */
export function _resetEnvForTests(): void {
  cached = null;
}