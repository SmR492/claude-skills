import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { indexPath } from './verdict-index.mjs';

export const sha256Of = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

export function captureText(line) {
  if (line.validator === 'rejected' || line.verdict === null || line.verdict === undefined) return 'verdict: a\n';
  const premises = line.premises ?? [];
  const rows = premises.length ? ['premises:', ...premises.map((_, n) => `- premise ${n + 1} -- checked: scripts/run.mjs:${n + 1}`)] : ['premises: none, no existing code or data touched'];
  return [
    'cdp6-contract: v1 fixture',
    `run: RUN-20260101-x task: ${line.task ?? 'D-1'}`,
    'fresh context: yes',
    'rejected alternative provided: yes',
    `conflict of interest: ${line.conflicted ? 'author of D-2' : 'none'}`,
    'severity scale: 🔴 blocks the task, 🟡 defect with a workaround, 🟢 polish',
    'verdict mapping: a = pass, a-with-conditions = pass-with-conditions, b = block, c = block, not-decidable = no pass',
    ...rows,
    ...(line.objections ?? []).map((o) => `objection: ${o} | artefact: idea/idea.md | evidence: idea/idea.md:1 | refuted when: shown`),
    `verdict: ${line.verdict}`,
    '',
  ].join('\n');
}

export function backCaptures(S, lines) {
  const dir = join(S, 'verdicts');
  mkdirSync(dir, { recursive: true });
  const out = lines.map((l) => {
    if (l.file !== undefined) return l;
    const text = l.text ?? captureText(l);
    writeFileSync(join(dir, `${l.id}.md`), text);
    return { ...l, file: `${l.id}.md`, sha256: sha256Of(text) };
  });
  writeFileSync(indexPath(S), out.map((l) => JSON.stringify(l)).join('\n') + (out.length ? '\n' : ''));
  return out;
}
