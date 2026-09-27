import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const connection = process.env.TEST_DATABASE_URL;
if (!connection)
  throw new Error('Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test.');
const url = new URL(connection);
if (!decodeURIComponent(url.pathname).endsWith('_test'))
  throw new Error('Refusing to test against a database whose name does not end in _test.');
const schema = `test_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('schema', schema);
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  NODE_ENV: 'test',
  JWT_SECRET: randomUUID() + randomUUID(),
};
const browser = process.argv.includes('--browser');
let exitCode = 0;
function run(args: string[], cwd?: string) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit', env, cwd });
  if (result.status !== 0) {
    exitCode = result.status ?? 1;
    throw new Error(`Command failed: pnpm ${args.join(' ')}`);
  }
}
try {
  run(['exec', 'prisma', 'migrate', 'deploy']);
  if (browser) {
    run(['exec', 'tsx', 'prisma/seed.ts']);
    run(['exec', 'playwright', 'test'], fileURLToPath(new URL('../../../', import.meta.url)));
  } else run(['exec', 'vitest', 'run']);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode ||= 1;
} finally {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection }) });
  try {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await db.$disconnect();
  }
}
process.exitCode = exitCode;
