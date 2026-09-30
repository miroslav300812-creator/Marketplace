import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { DATABASE_URL: 'file:./test.db', NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-123', ADMIN_PASSWORD: 'test-admin' },
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    testTimeout: 20000
  }
});
