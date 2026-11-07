'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', 'qa-profile/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: globals.node },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    // page.evaluate() callbacks run inside the browser page.
    files: ['test/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['renderer.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        writer: 'readonly',
        marked: 'readonly',
        mermaid: 'readonly',
        DOMPurify: 'readonly',
      },
    },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
];
