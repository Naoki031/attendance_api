// @ts-check
// ESLint v9 flat config
import tseslint from 'typescript-eslint'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import unicorn from 'eslint-plugin-unicorn'

export default tseslint.config(
  // Ignored paths
  {
    ignores: ['dist/', 'node_modules/', 'eslint.config.mjs', 'coverage/'],
  },

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Prettier: disables conflicting ESLint rules + runs Prettier as linter rule
  prettierRecommended,

  // Custom rules
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prettier formatting — mirror .prettierrc exactly
      'prettier/prettier': [
        'error',
        {
          printWidth: 100,
          tabWidth: 2,
          useTabs: false,
          singleQuote: true,
          trailingComma: 'all',
          bracketSpacing: true,
          arrowParens: 'always',
          endOfLine: 'lf',
          semi: false,
        },
      ],

      // TypeScript
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // NestJS decorators use parameter properties heavily
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // No single-character variable or parameter names (except _ for ignored vars)
      'id-length': ['error', { min: 2, exceptions: ['_'], properties: 'never' }],

      // Bare 'id' as a parameter is forbidden — use entity-specific name (userId, countryId, etc.)
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(FunctionDeclaration, ArrowFunctionExpression, FunctionExpression) > .params > Identifier[name="id"]',
          message:
            'Use a descriptive ID parameter name (e.g., userId, countryId) instead of bare "id".',
        },
      ],

      // No abbreviations — identifiers must be written in full
      'unicorn/prevent-abbreviations': [
        'error',
        {
          allowList: {
            // NestJS / TypeScript ecosystem acronyms — not abbreviations
            Dto: true,
            dto: true,
          },
        },
      ],
    },
    plugins: { unicorn },
  },

  // Test files — relax rules
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
