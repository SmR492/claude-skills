import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readProbeRecord(dataDir, version) {
  try {
    const rec = JSON.parse(readFileSync(join(dataDir, 'probes', `${version}.json`), 'utf8'));
    if (!rec || typeof rec.accepted?.sha256 !== 'string' || rec.accepted.sha256.length !== 64) return null;
    return rec;
  } catch {
    return null;
  }
}

export function probePassed(rec, row) {
  return rec?.rows?.[row]?.passed === true;
}

export function modePrompts(rec, mode) {
  return rec?.rows?.['A-5']?.modes?.[mode]?.prompt === true;
}
