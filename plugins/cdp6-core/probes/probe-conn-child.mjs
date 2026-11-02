import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const conn = join(dirname(fileURLToPath(import.meta.url)), 'probe-conn.mjs');
spawnSync('node', [conn, process.argv[2]], { stdio: 'inherit' });
