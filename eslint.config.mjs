import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      '.static-build-excluded/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // Inline PNG data URLs from the Python runner are not optimizable images.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
