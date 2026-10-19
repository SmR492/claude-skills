import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PLUGIN = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PLUGINS = join(PLUGIN, '..');
const HOOK = join(PLUGIN, 'hooks', 'require-contract.mjs');

const run = (env, input) => spawnSync('node', [HOOK], { env: { PATH: process.env.PATH, ...env }, input: JSON.stringify(input), encoding: 'utf8' });

test('cdp5-agents hooks match the domain-agents prefix, so the contract reaches these agents', () => {
  const hooks = JSON.parse(readFileSync(join(PLUGINS, 'cdp5-agents', 'hooks', 'hooks.json'), 'utf8')).hooks;
  for (const event of ['SubagentStart', 'SubagentStop']) {
    assert.ok(hooks[event].some((g) => new RegExp(g.matcher).test('domain-agents:psy-grenzwaechter')), `${event} must match domain-agents:`);
  }
});

test('require-contract: silent when the sibling cdp5-agents core exists (marketplace layout)', () => {
  const sub = run({ CLAUDE_PLUGIN_ROOT: PLUGIN }, { hook_event_name: 'SubagentStart', agent_type: 'domain-agents:psy-grenzwaechter' });
  assert.equal(sub.status, 0, sub.stderr);
  assert.equal(sub.stdout, '');
  const session = run({ CLAUDE_PLUGIN_ROOT: PLUGIN }, { hook_event_name: 'SessionStart', source: 'startup' });
  assert.equal(session.status, 0);
  assert.equal(session.stdout, '');
});

test('require-contract: without cdp5-agents the agent gets CONTRACT-MISSING and the session a warning', () => {
  const root = mkdtempSync(join(tmpdir(), 'domain-agents-'));
  const alone = join(root, 'domain-agents');
  mkdirSync(join(alone, 'hooks'), { recursive: true });
  try {
    const sub = run({ CLAUDE_PLUGIN_ROOT: alone }, { hook_event_name: 'SubagentStart', agent_type: 'domain-agents:marketing-strategist' });
    assert.equal(sub.status, 2);
    assert.match(JSON.parse(sub.stdout).hookSpecificOutput.additionalContext, /^CONTRACT-MISSING/);
    const session = run({ CLAUDE_PLUGIN_ROOT: alone }, { hook_event_name: 'SessionStart', source: 'startup' });
    assert.equal(session.status, 0);
    assert.match(JSON.parse(session.stdout).hookSpecificOutput.additionalContext, /cdp5-agents plugin is not installed/);
    // an explicit CDP5_AGENTS_ROOT rescues a non-sibling installation
    const rescued = run({ CLAUDE_PLUGIN_ROOT: alone, CDP5_AGENTS_ROOT: join(PLUGINS, 'cdp5-agents') }, { hook_event_name: 'SubagentStart', agent_type: 'domain-agents:marketing-strategist' });
    assert.equal(rescued.status, 0);
    assert.equal(rescued.stdout, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('every domain agent carries the CONTRACT-MISSING fallback sentence and names absolute pack paths', () => {
  const dir = join(PLUGIN, 'agents');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const text = readFileSync(join(dir, f), 'utf8');
    assert.match(text, /answer with the single line `CONTRACT-MISSING` and stop/, `${f} lacks the fallback`);
    assert.match(text, /absolute file paths in the brief/, `${f} must ask for absolute pack paths`);
  }
});

test('psy session skills carry the contract rules by their own text', () => {
  for (const name of ['psy-diagnostik-navigator', 'psy-therapiebegleiter', 'psy-paar-moderator']) {
    const text = readFileSync(join(PLUGIN, 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(text, /core rules 3 .* 7 .* and 8 .* apply to this persona/s, `${name} must bind rules 3, 7 and 8`);
  }
  const crisis = readFileSync(join(PLUGIN, 'skills', 'psy-knowledge', 'entries', 'krisen-eskalation.md'), 'utf8');
  assert.match(crisis, /0800 1110111 \/ 0800 1110222 \/ 116 123 \(kostenfrei, Tag und Nacht; Quelle: telefonseelsorge\.de, geprueft 2026-10-19\)/);
  assert.doesNotMatch(crisis, /PRIV:/);
  const overrides = JSON.parse(readFileSync(join(PLUGIN, 'skills', 'psy-knowledge', 'overrides.json'), 'utf8'));
  assert.ok(overrides['PSY:krisen-eskalation'].length >= 2, 'the hand-applied crisis patch is also an override for the next rebuild');
});
