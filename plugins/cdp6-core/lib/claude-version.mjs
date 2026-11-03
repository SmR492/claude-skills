import { spawnSync } from 'node:child_process';

export function readClaudeVersion(env) {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8', env, timeout: 10000 });
  const m = r.status === 0 ? /(\d+)\.(\d+)\.(\d+)/.exec(r.stdout ?? '') : null;
  if (!m) return null;
  return { text: `${m[1]}.${m[2]}.${m[3]}`, parts: [Number(m[1]), Number(m[2]), Number(m[3])] };
}
