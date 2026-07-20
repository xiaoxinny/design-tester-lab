import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { createInterface, type Interface } from 'node:readline';
import { pathToFileURL } from 'node:url';

type SetupMode = 'local' | 'supabase' | 'postgres';
type Secrets = { encryptionKey: string; sessionSecret: string };
type Values = Record<string, string>;

export function validateEmail(value: string): boolean {
  return value.includes('@');
}

export function validatePostgresUrl(value: string): boolean {
  return value.startsWith('postgres://') || value.startsWith('postgresql://');
}

export function buildEnv(mode: SetupMode, secrets: Secrets, values: Values): string {
  const lines = mode === 'local'
    ? [
        `ENCRYPTION_KEY=${secrets.encryptionKey}`,
        `SESSION_SECRET=${secrets.sessionSecret}`,
        'PORT=3030',
        'NODE_ENV=development',
        `LOCAL_DEFAULT_USER_EMAIL=${values.LOCAL_DEFAULT_USER_EMAIL}`,
        `LOCAL_DEFAULT_USER_PASSWORD=${values.LOCAL_DEFAULT_USER_PASSWORD}`,
      ]
    : mode === 'supabase'
      ? [
          'ONLINE_MODE=1',
          `ENCRYPTION_KEY=${secrets.encryptionKey}`,
          `SESSION_SECRET=${secrets.sessionSecret}`,
          `NEXT_PUBLIC_SUPABASE_URL=${values.NEXT_PUBLIC_SUPABASE_URL}`,
          `NEXT_PUBLIC_SUPABASE_ANON_KEY=${values.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          `SUPABASE_SERVICE_ROLE_KEY=${values.SUPABASE_SERVICE_ROLE_KEY}`,
          `SUPABASE_DB_URL=${values.SUPABASE_DB_URL}`,
        ]
      : [
          'ONLINE_MODE=1',
          `ENCRYPTION_KEY=${secrets.encryptionKey}`,
          `SESSION_SECRET=${secrets.sessionSecret}`,
          `DATABASE_URL=${values.DATABASE_URL}`,
        ];

  return `${lines.join('\n')}\n`;
}

function ask(rl: Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    console.log(question);
    rl.question('> ', (answer) => resolve(answer.trim()));
  });
}

async function askUntil(
  rl: Interface,
  question: string,
  validate: (value: string) => boolean,
  error: string,
): Promise<string> {
  while (true) {
    const value = await ask(rl, question);
    if (validate(value)) return value;
    console.log(error);
  }
}

function generateSecrets(): Secrets {
  return {
    encryptionKey: randomBytes(32).toString('base64'),
    sessionSecret: randomBytes(32).toString('base64'),
  };
}

function writeEnvironment(mode: SetupMode, secrets: Secrets, values: Values): void {
  writeFileSync('.env', buildEnv(mode, secrets, values), { encoding: 'utf8', mode: 0o600 });
  console.log('\nGenerated values:');
  console.log(`ENCRYPTION_KEY=${secrets.encryptionKey}`);
  console.log(`SESSION_SECRET=${secrets.sessionSecret}`);
  console.log('\n.env written.');
}

export async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let interrupted = false;
  rl.on('SIGINT', () => {
    interrupted = true;
    console.log('\nSetup cancelled.');
    rl.close();
  });

  try {
    console.log('design-tester-lab setup');
    console.log('This will create your .env file and initialize the database.\n');

    if (existsSync('.env')) {
      const overwrite = (await ask(rl, 'A .env file already exists. Overwrite? [y/N]')).toLowerCase();
      if (overwrite !== 'y' && overwrite !== 'yes') {
        console.log('Setup cancelled.');
        return;
      }
    }

    const mode = await askUntil(
      rl,
      'Which mode? [1] Local (SQLite, single user) [2] Online (PostgreSQL/Supabase, multi-user)',
      (value) => value === '' || value === '1' || value === '2',
      'Enter 1 or 2.',
    );
    const secrets = generateSecrets();

    if (mode === '' || mode === '1') {
      const email = await askUntil(rl, 'Default user email:', validateEmail, 'Enter a valid email address.');
      const password = await askUntil(
        rl,
        'Default user password:',
        (value) => value.length >= 8,
        'Password must be at least 8 characters.',
      );
      writeEnvironment('local', secrets, {
        LOCAL_DEFAULT_USER_EMAIL: email,
        LOCAL_DEFAULT_USER_PASSWORD: password,
      });
      console.log('\nApplying database schema...');
      execSync('pnpm db:push', { stdio: 'inherit' });
      console.log('\nSeeding augmentations...');
      execSync('pnpm db:seed', { stdio: 'inherit' });
      console.log('\nSetup complete! Run: pnpm dev');
      return;
    }

    const provider = await askUntil(
      rl,
      'Database provider? [1] Supabase [2] Direct PostgreSQL',
      (value) => value === '' || value === '1' || value === '2',
      'Enter 1 or 2.',
    );

    if (provider === '' || provider === '1') {
      const values: Values = {};
      for (const name of [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_DB_URL',
      ]) {
        values[name] = await askUntil(rl, `${name}:`, (value) => value.length > 0, `${name} is required.`);
      }
      writeEnvironment('supabase', secrets, values);
      console.log('\nApply schema: psql $SUPABASE_DB_URL < drizzle/0000_smooth_blue_blade.sql');
      console.log('Seed: pnpm db:seed:supabase');
    } else {
      const databaseUrl = await askUntil(
        rl,
        'DATABASE_URL:',
        validatePostgresUrl,
        'DATABASE_URL must start with postgres:// or postgresql://.',
      );
      writeEnvironment('postgres', secrets, { DATABASE_URL: databaseUrl });
      console.log('\nApply schema: psql $DATABASE_URL < drizzle/0000_smooth_blue_blade.sql && psql $DATABASE_URL < drizzle/0001_absent_unicorn.sql');
      console.log('Then run: pnpm dev');
    }

    console.log('\nSetup complete!');
  } finally {
    if (!interrupted) rl.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(`\nSetup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
