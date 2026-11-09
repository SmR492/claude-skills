import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function homeOf(env) {
  return env.HOME ?? homedir();
}

export function readUserSettings(env) {
  try {
    const doc = JSON.parse(readFileSync(join(homeOf(env), '.claude', 'settings.json'), 'utf8'));
    return doc && typeof doc === 'object' && !Array.isArray(doc) ? doc : null;
  } catch {
    return null;
  }
}

export function expand(spec, home, { rule }) {
  if (spec === '~') return home;
  if (spec.startsWith('~/')) return join(home, spec.slice(2));
  if (spec.startsWith('//')) return spec.slice(1);
  if (!rule && spec.startsWith('/')) return spec;
  return null;
}

export function toRegex(abs) {
  let out = '';
  for (let i = 0; i < abs.length; i += 1) {
    const c = abs[i];
    if (c === '*' && abs[i + 1] === '*') {
      if (abs[i + 2] === '/') {
        out += '(?:.*/)?';
        i += 2;
      } else {
        out += '.*';
        i += 1;
      }
    } else if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else {
      out += c.replace(/[\\^$.|+(){}[\]]/g, '\\$&');
    }
  }
  return new RegExp(`^${out.replace(/\/+$/, '')}(?:/.*)?$`);
}

export function covers(spec, path, env, { rule = false } = {}) {
  if (typeof spec !== 'string') return false;
  const abs = expand(spec, homeOf(env), { rule });
  return abs !== null && toRegex(abs).test(path);
}

export function rulesCover(settings, tool, path, env) {
  const deny = settings?.permissions?.deny;
  if (!Array.isArray(deny)) return false;
  return deny.some((entry) => {
    const m = /^(\w+)\((.*)\)$/.exec(typeof entry === 'string' ? entry : '');
    return m !== null && m[1] === tool && covers(m[2], path, env, { rule: true });
  });
}

export function sandboxCovers(settings, key, path, env) {
  const list = settings?.sandbox?.filesystem?.[key];
  return Array.isArray(list) && list.some((entry) => covers(entry, path, env));
}

export function credentialCovers(settings, path, env) {
  const list = settings?.sandbox?.credentials?.deny;
  return Array.isArray(list) && list.some((entry) => covers(entry, path, env));
}

export function missingRules(settings, env, { dataDir, pluginRoot }) {
  const home = homeOf(env);
  const keyDir = join(home, '.config', 'cdp6-core');
  const transcripts = join(home, '.claude', 'projects');
  const missing = [];
  const rule = (tool, samples, what) => {
    if (!samples.some((p) => rulesCover(settings, tool, p, env))) missing.push(`${tool} deny rule on ${what}`);
  };
  const ruleAll = (tool, samples, what) => {
    if (!samples.every((p) => rulesCover(settings, tool, p, env))) missing.push(`${tool} deny rule on ${what}`);
  };
  const entry = (key, samples, what) => {
    if (!samples.some((p) => sandboxCovers(settings, key, p, env))) missing.push(`sandbox.filesystem.${key} entry on ${what}`);
  };
  const key = [join(keyDir, 'hook.key')];
  for (const tool of ['Read', 'Edit']) rule(tool, key, '~/.config/cdp6-core/');
  entry('denyRead', key, '~/.config/cdp6-core/');
  entry('denyWrite', key, '~/.config/cdp6-core/');
  const transcript = [join(transcripts, 'x', 't.jsonl')];
  rule('Read', transcript, '~/.claude/projects/');
  entry('denyRead', transcript, '~/.claude/projects/');
  for (const tool of ['Edit']) {
    ruleAll(tool, ['hook-nonces.jsonl', 'active-runs.json', join('probes', 'x.json'), join('runs', 'RUN-x', 'run.json'), 'hooks-fired.jsonl', 'grants.json', join('x', 'y', 'z.txt')].map((f) => join(dataDir, f)), 'the data directory');
    ruleAll(tool, ['scripts/run.mjs', 'hooks/guard-shell.mjs', 'lib/hook-key.mjs', 'a/b/c.txt'].map((f) => join(pluginRoot, f)), 'the plugin root');
  }
  return missing;
}
