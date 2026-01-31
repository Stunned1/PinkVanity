import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve('extension', 'dist');

rmSync(distDir, { recursive: true, force: true });
console.log(`Removed ${distDir}`);

