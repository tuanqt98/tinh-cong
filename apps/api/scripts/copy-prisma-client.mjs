import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(appRoot, 'src/generated/prisma');
const target = resolve(appRoot, 'dist/generated/prisma');

if (!existsSync(source)) {
  throw new Error(`Prisma client is missing at ${source}. Run prisma generate first.`);
}

mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true, force: true });
