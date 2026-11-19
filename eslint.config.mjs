import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'

export default tseslint.config(
  // Hidden folders (local tools, editor settings) are never linted
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'resources/**', '**/*.d.ts', '**/.*/**', 'site/**', 'conception/**', 'graphify-out/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // An eslint-disable says why after « -- », and one that no longer hides anything is an error
  comments.recommended,
  { linterOptions: { reportUnusedDisableDirectives: 'error' }, rules: { '@eslint-community/eslint-comments/require-description': 'error' } },
  {
    files: ['src/main/**/*.{ts,mjs}', 'src/preload/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.mjs', '*.config.{ts,mjs}'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    rules: {
      // `_x` = intentionally unused (destructuring to drop a field)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
)
