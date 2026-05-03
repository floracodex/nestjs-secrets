// @ts-check
import {createConfig} from '@floracodex/eslint-config/backend';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    ...createConfig({
        rootDir: import.meta.dirname,
        ignores: ['example/**']
    }),
    {
        // Runtime dispatch over heterogeneous SDK clients. The SDK packages
        // are optional peer dependencies and cannot be hard-imported here,
        // so `client: any` is intentional and the no-unsafe-* warnings it
        // generates are not actionable.
        files: ['src/services/secrets-loader.service.ts'],
        rules: {
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off'
        }
    }
);
