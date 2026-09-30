import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Builds a throwaway SQLite database for the test run. */
export default function setup() {
  const env = { ...process.env, DATABASE_URL: 'file:./test.db' };
  for (const f of ['test.db', 'test.db-journal']) fs.rmSync(path.resolve('prisma', f), { force: true });
  execSync('npx prisma db push --skip-generate', { env, stdio: 'ignore' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore' });
}
