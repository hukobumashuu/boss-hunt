import { enforceTarget, parseCliArgs } from './target-guard';

const [mode, ...rest] = process.argv.slice(2);

if (mode !== 'dev' && mode !== 'production') {
  console.error(
    'Usage: bun src/db/preflight.ts <dev|production> [--allow-deploy]',
  );
  process.exit(2);
}

const { allowDeploy } = parseCliArgs(rest);
enforceTarget(mode, {
  action: process.env['npm_lifecycle_event'] ?? 'database command',
  allowDeploy,
});
