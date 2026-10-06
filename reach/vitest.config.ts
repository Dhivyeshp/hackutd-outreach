import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/lib/**/*.ts'], exclude: ['src/lib/db.ts', 'src/lib/gmail.ts', 'src/lib/auth.ts'] },
  },
});
