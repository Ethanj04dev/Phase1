const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['node_modules/**', '.expo/**', '.expo-verify/**', 'dist/**', 'coverage/**', 'supabase/functions/**', 'public/**'],
  },
  {
    // Scoped to TypeScript files: the typescript-eslint plugin is only
    // registered for these by the Expo config, and a rule cannot reference a
    // plugin that is not in scope for the matched files.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // The brief is explicit about avoiding `any`; make it a hard error rather
      // than a warning so it cannot accumulate quietly.
      '@typescript-eslint/no-explicit-any': 'error',
      // Unused declarations are already enforced by tsc via noUnusedLocals.
      'no-unused-vars': 'off',
    },
  },
]);
