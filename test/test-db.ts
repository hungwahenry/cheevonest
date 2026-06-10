import 'dotenv/config';

export function testDatabaseUrl(): string {
  const base =
    process.env.DATABASE_URL ?? 'postgresql://127.0.0.1:5432/cheevo_nest';

  if (base.includes('cheevo_nest_test')) {
    return base;
  }

  return base.replace(/\/[^/?]+(\?.*)?$/, '/cheevo_nest_test$1');
}
