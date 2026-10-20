import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const saved = resolve(root, '.local-run/rtdb-emulator-data');
const firebase = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const args = [firebase, 'emulators:start', '--project', 'demo-narayana-naturals',
  '--only', 'auth,database', `--export-on-exit=${saved}`];

if (existsSync(resolve(saved, 'firebase-export-metadata.json'))) {
  args.push(`--import=${saved}`);
  console.log('Restoring saved local accounts and store data.');
} else {
  console.log('Starting a new local backend. Seed the fixtures once it is ready.');
}

// Run the CLI in this process so its own shutdown/export handlers control
// emulator cleanup without an extra parent exiting ahead of the export.
process.chdir(root);
process.argv = [process.execPath, ...args];
await import(pathToFileURL(firebase).href);
