import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'hyphalbase-sdk',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
