import { resolveEnv, EnvValidationError } from '../src/lib/env';

const validKey = Buffer.alloc(32, 1).toString('base64'); // 32 bytes of 0x01
const validSecret = Buffer.alloc(32, 2).toString('base64'); // 32 bytes of 0x02, distinct from validKey

async function expectThrow(label: string, env: Partial<NodeJS.ProcessEnv>, expectedFragment: string): Promise<void> {
  try {
    const result = await resolveEnv(env);
    console.log(`FAIL: ${label} -- expected throw, got mode=${result.mode}`);
  } catch (e) {
    if (e instanceof EnvValidationError && e.message.includes(expectedFragment)) {
      console.log(`OK:   ${label} -- "${e.message}"`);
    } else {
      console.log(`FAIL: ${label} -- wrong error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

async function expectOk(label: string, env: Partial<NodeJS.ProcessEnv>): Promise<void> {
  try {
    const result = await resolveEnv(env);
    console.log(`OK:   ${label} -- mode=${result.mode}`);
  } catch (e) {
    console.log(`FAIL: ${label} -- unexpected throw: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  await expectThrow('empty env throws on missing ENCRYPTION_KEY', {}, 'ENCRYPTION_KEY');
  await expectThrow('short ENCRYPTION_KEY throws size error', { ENCRYPTION_KEY: 'short', SESSION_SECRET: validSecret }, '32 bytes');
  await expectThrow('short SESSION_SECRET throws size error', { ENCRYPTION_KEY: validKey, SESSION_SECRET: 'short' }, '32 bytes');
  await expectThrow('AUTH_DISABLED + non-loopback host throws footgun', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    AUTH_DISABLED: 'true',
    HOST: '0.0.0.0',
  }, 'non-loopback');
  await expectThrow('AUTH_DISABLED + IPv6 non-loopback throws footgun', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    AUTH_DISABLED: 'true',
    HOST: '::ffff:192.168.1.1',
  }, 'non-loopback');
  await expectThrow('AUTH_DISABLED + unset HOST throws footgun (regression of GLM review 1.1)', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    AUTH_DISABLED: 'true',
  }, 'non-loopback');
  await expectOk('AUTH_DISABLED + unset HOST with explicit ack override is OK', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    AUTH_DISABLED: 'true',
    I_UNDERSTAND_AUTH_IS_DISABLED_AND_I_AM_EXPOSING_MY_NETWORK: 'true',
  });
  await expectOk('AUTH_DISABLED + loopback is OK', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    AUTH_DISABLED: 'true',
    HOST: '127.0.0.1',
  });
  await expectOk('AUTH_DISABLED + IPv6 loopback is OK', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    AUTH_DISABLED: 'true',
    HOST: '::1',
  });
  await expectThrow('ENCRYPTION_KEY == SESSION_SECRET throws key-separation error', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validKey,
  }, 'must be different');
  await expectThrow('env var with CRLF throws control-char error', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    LOCAL_DEFAULT_USER_EMAIL: 'evil@x\r\nSet-Cookie: x=1',
  }, 'control character');
  await expectOk('local mode is OK with no user (login page will prompt)', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
  });
  await expectOk('local mode with default user is OK', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    LOCAL_DEFAULT_USER_EMAIL: 'me@home.local',
    LOCAL_DEFAULT_USER_PASSWORD: 'correct-horse-battery',
  });
  await expectOk('supabase mode is OK with all supabase vars set', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJxxx',
  });
  await expectOk('supabase mode is OK without the optional secret key (client-only auth)', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  });
  await expectOk('supabase mode accepts the new SUPABASE_SECRET_KEY name as a legacy alias', {
    ENCRYPTION_KEY: validKey,
    SESSION_SECRET: validSecret,
    NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'eyJxxx',
  });
}

main().catch((e) => {
  console.error('UNEXPECTED:', e);
  process.exit(1);
});
