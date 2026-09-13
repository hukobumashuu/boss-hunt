import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src/db/migrations/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Must come last - turns off any ESLint stylistic rules that would
  // otherwise fight with Prettier's formatting decisions.
  eslintConfigPrettier,
);
