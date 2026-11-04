import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, beforeEach } from 'node:test';

const perTest = new Set();
const perFile = new Set();
let inTest = false;

function drop(set) {
  for (const dir of set) rmSync(dir, { recursive: true, force: true });
  set.clear();
}

beforeEach(() => {
  inTest = true;
});

afterEach(() => {
  inTest = false;
  drop(perTest);
});

after(() => drop(perFile));

export function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  (inTest ? perTest : perFile).add(dir);
  return dir;
}
