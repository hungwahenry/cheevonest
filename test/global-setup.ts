import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-db';

export default function globalSetup(): void {
  const url = testDatabaseUrl();
  const dbName = new URL(url).pathname.slice(1);

  try {
    execSync(`createdb ${dbName}`, { stdio: 'ignore' });
  } catch {
    // database already exists
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
