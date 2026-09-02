/**
 * Loads .env no matter which directory the process was started from.
 *
 * `import 'dotenv/config'` resolves .env against process.cwd() and never
 * looks upward. Every entry point here is started as `npm run … --prefix
 * server`, which makes cwd `server/`, while .env.example and every
 * instruction in the docs put .env at the repo root. So following the
 * instructions loaded nothing at all, and the error you got told you to
 * "copy .env.example to .env" -- which you had just done.
 *
 * Rather than move the file somewhere less obvious, look in the places a
 * reasonable person would put it. First match wins; nothing already in the
 * real environment is overridden.
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // <repo>/server/src

const candidates = [
  resolve(here, '../../.env'), // repo root -- where the docs say to put it
  resolve(here, '../.env'), // server/, next to the code that reads it
  resolve(process.cwd(), '.env'), // wherever you happened to be standing
];

/** Absolute paths of the .env files actually found and loaded, in order. */
export const loadedEnvFiles: string[] = [];

for (const path of [...new Set(candidates)]) {
  if (!existsSync(path)) continue;
  config({ path, override: false });
  loadedEnvFiles.push(path);
}
