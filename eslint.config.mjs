import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['dist/', 'vendor/', '*.js', '*.cjs', '*.mjs', 'test/'],
    },
    js.configs.recommended,
    jsdoc.configs['flat/recommended'],
    {
        plugins: {
            jsdoc: jsdoc,
        },
        languageOptions: {
            ecmaVersion: 2020,
            globals: {
                ...globals.browser,
                ...globals.es2020,
                ...globals.mocha,
            },
        },
        rules: {
            'no-unused-vars': ['error', {args: 'none'}],
            semi: [2, 'always'],
            'jsdoc/require-jsdoc': 0,
            'jsdoc/require-param-description': 0,
            'jsdoc/require-property-description': 0,
            'jsdoc/require-returns': 0,
            'jsdoc/require-param-type': 0,
            'jsdoc/require-returns-description': 0,
            'jsdoc/tag-lines': 0,
        },
    },
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
            },
        },
        rules: {
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unused-vars': ['error', {args: 'none'}],
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
        },
    },
];
