#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { pluginRoot, paths, extractCore, renderCore } from '../lib/contract.mjs';

export function generate(root, { check = false } = {}) {
  const p = paths(root);
  const skill = extractCore(readFileSync(p.skill, 'utf8'));
  const rendered = renderCore(skill.version, skill.body);
  const current = existsSync(p.core) ? readFileSync(p.core, 'utf8') : null;
  if (check) {
    if (current === rendered) return { changed: false, path: p.core };
    return { changed: true, path: p.core, reason: current === null ? 'core.md missing' : 'core.md differs from SKILL.md core' };
  }
  if (current !== rendered) writeFileSync(p.core, rendered);
  return { changed: current !== rendered, path: p.core };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const check = argv.includes('--check');
  const r = generate(pluginRoot(env), { check });
  if (check) {
    if (r.changed) {
      console.error(`worker-contract: ${r.reason}; run scripts/generate-contract.mjs`);
      return 1;
    }
    console.log('worker-contract: core.md is current');
    return 0;
  }
  console.log(`worker-contract: ${r.changed ? 'wrote' : 'unchanged'} ${r.path}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
