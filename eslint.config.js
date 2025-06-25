import js from '@eslint/js';

export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                // Add browser globals
                document: 'readonly',
                window: 'readonly',
                console: 'readonly',
                // Add other globals as needed
            }
        },
        rules: {
            'semi': ['error', 'always'],
            'no-unused-vars': 'warn',
            'no-console': 'warn',
            'no-undef': 'error'
        }
    }
];
