import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
});
