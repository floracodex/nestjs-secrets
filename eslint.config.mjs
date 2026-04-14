// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**'],
    },

    // ── Base configs ──────────────────────────────────────────────
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,

    // ── Language options ──────────────────────────────────────────
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            sourceType: 'commonjs',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // ── Stylistic / formatting ────────────────────────────────────
    {
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            // Indentation — 4 spaces (matches .editorconfig)
            '@stylistic/indent': ['warn', 4, { SwitchCase: 1 }],

            // Quotes — single (matches .editorconfig)
            '@stylistic/quotes': ['warn', 'single', { avoidEscape: true }],

            // Semicolons — always
            '@stylistic/semi': ['warn', 'always'],

            // Trailing commas — ES5 style
            '@stylistic/comma-dangle': ['error', 'never'],

            // Brace style — 1TBS
            '@stylistic/brace-style': ['warn', '1tbs', { allowSingleLine: true }],

            // Arrow function parens — always
            '@stylistic/arrow-parens': ['warn', 'always'],

            // Spacing
            '@stylistic/comma-spacing': 'warn',
            '@stylistic/key-spacing': 'warn',
            '@stylistic/keyword-spacing': 'warn',
            '@stylistic/space-before-blocks': 'warn',
            '@stylistic/space-infix-ops': 'warn',
            '@stylistic/object-curly-spacing': ['warn', 'never'],
            '@stylistic/array-bracket-spacing': ['warn', 'never'],
            '@stylistic/space-before-function-paren': ['warn', {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always',
            }],

            // Type annotation spacing
            '@stylistic/type-annotation-spacing': 'warn',

            // Block spacing
            '@stylistic/block-spacing': 'warn',

            // No multiple empty lines
            '@stylistic/no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1, maxBOF: 0 }],

            // Trailing newline
            '@stylistic/eol-last': ['warn', 'always'],

            // No trailing spaces
            '@stylistic/no-trailing-spaces': 'warn',

            // Member delimiter style for interfaces/types
            '@stylistic/member-delimiter-style': ['warn', {
                multiline: { delimiter: 'semi', requireLast: true },
                singleline: { delimiter: 'semi', requireLast: false },
            }],
        },
    },

    // ── TypeScript rules ──────────────────────────────────────────
    {
        rules: {
            // Permit `any` — code review catches misuse
            '@typescript-eslint/no-explicit-any': 'off',

            // Async safety
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',

            // Downgrade no-unsafe-* family to warn
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-enum-comparison': 'warn',

            // Other type-checked rules — downgrade to warn for existing code
            '@typescript-eslint/unbound-method': 'warn',
            '@typescript-eslint/no-redundant-type-constituents': 'warn',
            '@typescript-eslint/no-base-to-string': 'warn',
            '@typescript-eslint/restrict-template-expressions': 'warn',
            '@typescript-eslint/no-misused-promises': 'warn',
            '@typescript-eslint/no-unused-expressions': 'warn',
            '@typescript-eslint/await-thenable': 'warn',
            '@typescript-eslint/no-empty-object-type': 'warn',

            // Prefer type-only imports where possible
            '@typescript-eslint/consistent-type-imports': ['warn', {
                prefer: 'type-imports',
                fixStyle: 'inline-type-imports',
                disallowTypeAnnotations: false,
            }],

            // Unused variables
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],

            // Naming conventions
            '@typescript-eslint/naming-convention': ['warn',
                {
                    selector: 'variable',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    leadingUnderscore: 'forbid',
                },
                {
                    selector: 'function',
                    format: ['camelCase'],
                },
                {
                    selector: 'typeLike',
                    format: ['PascalCase'],
                },
                {
                    selector: 'enumMember',
                    format: ['PascalCase'],
                },
                {
                    selector: 'classMethod',
                    format: ['camelCase'],
                    leadingUnderscore: 'forbid',
                },
                {
                    selector: 'classProperty',
                    format: ['camelCase', 'UPPER_CASE'],
                    leadingUnderscore: 'forbid',
                },
                {
                    selector: 'objectLiteralProperty',
                    format: null,
                },
                {
                    selector: 'parameter',
                    format: ['camelCase'],
                    leadingUnderscore: 'forbid',
                },
            ],

            // Allow empty functions (common in NestJS lifecycle hooks)
            '@typescript-eslint/no-empty-function': 'off',

            // Require await in async functions
            '@typescript-eslint/require-await': 'warn',
        },
    },

    // ── Best practices ────────────────────────────────────────────
    {
        rules: {
            // Equality — always strict
            'eqeqeq': ['error', 'always', { null: 'ignore' }],

            // Prefer const
            'prefer-const': 'warn',

            // No var
            'no-var': 'error',

            // Curly braces — always (even single-line)
            'curly': ['warn', 'all'],

            // No console — use NestJS Logger
            'no-console': 'warn',

            // No duplicate imports
            'no-duplicate-imports': 'warn',

            // Prefer template literals
            'prefer-template': 'warn',

            // No throw literals — throw Error objects
            'no-throw-literal': 'off',
            '@typescript-eslint/only-throw-error': 'warn',

            // Prefer rest params over arguments
            'prefer-rest-params': 'warn',

            // Prefer spread over .apply()
            'prefer-spread': 'warn',

            // No useless constructors
            'no-useless-constructor': 'off',
            '@typescript-eslint/no-useless-constructor': 'warn',

            // Default exports discouraged
            'no-restricted-exports': ['warn', {
                restrictDefaultExports: {
                    direct: true,
                    named: true,
                    defaultFrom: true,
                    namedFrom: true,
                    namespaceFrom: true,
                },
            }],
        },
    },
);
