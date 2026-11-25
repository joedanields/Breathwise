import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      unstubGlobals: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}', 'shared/**/*.ts', 'functions/**/*.ts'],
        exclude: ['src/main.tsx', '**/*.d.ts'],
        reporter: ['text', 'html', 'lcov', 'json-summary'],
        // TESTING.md §1 / CLAUDE.md: lib + shared >= 90 %, overall >= 80 %.
        thresholds: {
          lines: 80,
          'src/lib/**': { lines: 90, branches: 90 },
          'shared/**': { lines: 90, branches: 90 },
        },
      },
    },
  }),
);
