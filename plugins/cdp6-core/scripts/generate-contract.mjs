#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isMainModule } from '../lib/paths.mjs';
import { extractCore, normalizeText, paths, pluginRoot, renderCore } from '../lib/contract.mjs';

export function generate(root, { check = false } = {}) {
  const p = paths(root);
  const skill = extractCore(readFileSync(p.skill, 'utf8'));
  const rendered = renderCore(skill.version, skill.body);
  const current = existsSync(p.core) ? readFileSync(p.core, 'utf8') : null;
  if (current !== null && normalizeText(current) === normalizeText(rendered)) return { changed: false, path: p.core };
  if (check) return { changed: true, path: p.core, reason: current === null ? 'core.md missing' : 'core.md differs from the SKILL.md core' };
  writeFileSync(p.core, rendered);
  return { changed: true, path: p.core };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const check = argv.includes('--check');
  let r;
  try {
    r = generate(pluginRoot(env), { check });
  } catch (e) {
    console.error(`generate-contract: ${e.message}`);
    return 1;
  }
  if (check) {
    if (r.changed) {
      console.error(`generate-contract: ${r.reason}; run scripts/generate-contract.mjs`);
      return 1;
    }
    console.log('generate-contract: core.md is current');
    return 0;
  }
  console.log(`generate-contract: ${r.changed ? 'wrote' : 'unchanged'} ${r.path}`);
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
