import esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outdir = resolve('extension', 'dist');
mkdirSync(outdir, { recursive: true });

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  sourcemap: true,
  target: 'es2022',
  format: 'iife',
  outdir,
  logLevel: 'info',
};

await esbuild.build({
  ...shared,
  entryPoints: [
    'extension/src/background.ts',
    'extension/src/content/content-script.ts',
    'extension/src/options/options.ts',
  ],
});

