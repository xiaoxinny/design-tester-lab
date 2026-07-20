import assert from 'node:assert/strict';
import { buildEnv, validateEmail, validatePostgresUrl } from './setup';

const secrets = {
  encryptionKey: Buffer.alloc(32, 1).toString('base64'),
  sessionSecret: Buffer.alloc(32, 2).toString('base64'),
};

assert.equal(validateEmail('user@example.com'), true);
assert.equal(validateEmail('invalid'), false);
assert.equal(validatePostgresUrl('postgres://localhost/app'), true);
assert.equal(validatePostgresUrl('postgresql://localhost/app'), true);
assert.equal(validatePostgresUrl('https://localhost/app'), false);

assert.equal(
  buildEnv('local', secrets, {
    LOCAL_DEFAULT_USER_EMAIL: 'user@example.com',
    LOCAL_DEFAULT_USER_PASSWORD: 'password123',
  }),
  `${[
    `ENCRYPTION_KEY=${secrets.encryptionKey}`,
    `SESSION_SECRET=${secrets.sessionSecret}`,
    'PORT=3030',
    'NODE_ENV=development',
    'LOCAL_DEFAULT_USER_EMAIL=user@example.com',
    'LOCAL_DEFAULT_USER_PASSWORD=password123',
  ].join('\n')}\n`,
);

assert.match(
  buildEnv('supabase', secrets, {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    SUPABASE_DB_URL: 'postgresql://localhost/app',
  }),
  /^ONLINE_MODE=1\n/,
);

assert.match(
  buildEnv('postgres', secrets, { DATABASE_URL: 'postgresql://localhost/app' }),
  /DATABASE_URL=postgresql:\/\/localhost\/app/,
);

console.log('setup tests passed');
