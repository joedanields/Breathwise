import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Code that ships to users (SPA, shared logic, Pages Functions). */
const RUNTIME_FILES = ['src/**/*.{ts,tsx}', 'shared/**/*.ts', 'functions/**/*.ts'];

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    'blob-report',
    '.wrangler',
  ]),

  // Plain JS / ESM scripts and config files.
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // All TypeScript: type-aware strict rules.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // React components (app + component tests).
  {
    files: ['src/**/*.tsx', 'tests/**/*.tsx'],
    extends: [
      reactHooks.configs.flat['recommended-latest'],
      jsxA11y.flatConfigs.strict,
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      // CLAUDE.md rule 5: AI output (and anything else) is rendered as text, never HTML.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'Render text nodes only; dangerouslySetInnerHTML is forbidden (CLAUDE.md rule 5).',
        },
      ],
    },
  },

  // CLAUDE.md rule 1: fixtures and MSW handlers are test-only. Runtime code must never
  // import anything from tests/ or the MSW library.
  {
    files: RUNTIME_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)tests(/|$)',
              message:
                'Runtime code must not import from tests/ (fixtures and mocks are test-only).',
            },
            {
              group: ['msw', 'msw/*'],
              message: 'MSW is test-only; runtime code must fetch live data.',
            },
          ],
        },
      ],
    },
  },

  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
]);
