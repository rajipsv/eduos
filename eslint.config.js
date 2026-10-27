import js from '@eslint/js';
import globals from 'globals';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

export default [
  {
    ignores: ['node_modules/**', 'docs/**', 'scripts/**', 'server/data/**'],
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, Chart: 'readonly' },
    },
    plugins: { 'no-unsanitized': noUnsanitized },
    rules: {
      // Flags innerHTML with unescaped values. Warning for now; becomes an error after XSS escaping (stage 2).
      'no-unsanitized/property': 'warn',
      'no-unsanitized/method': 'warn',
    },
  },
  {
    files: ['server/**/*.{js,mjs}', 'api/**/*.js', 'test/**/*.js', 'serve.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
