import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/test-db';

export default defineConfig({
  oxc: false,
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    globalSetup: ['./test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl(),
      MAIL_DRIVER: 'log',
      STORAGE_DISK: 'local',
      STORAGE_DIR: 'storage/test',
      SYSTEM_CONFIG_CACHE_TTL_SECONDS: '0',
      // Hermetic: never inherit a developer's real integration keys from .env.
      GIPHY_API_KEY: '',
      GOOGLE_PLACES_API_KEY: '',
      PAYSTACK_SECRET_KEY: '',
      FLUTTERWAVE_SECRET_KEY: '',
      RESEND_API_KEY: '',
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
