import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASES } from './phases.mjs';
import { activeStop, stopFor } from './stop-guard.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

function state(content) {
  const S = tempDir('cdp6-stopguard-');
  mkdirSync(S, { recursive: true });
  if (content !== null) writeFileSync(join(S, 'counters.json'), typeof content === 'string' ? content : JSON.stringify(content));
  return S;
}

const spawn = (over = {}) => ({ agent_type: 'cdp6-core:devils-advocate', task: 'D-4', agent_id: 'agent-3', finished_at: '2026-11-06T10:00:00.000Z', ...over });

test('the reason names the agent id, role, task, cause and the way out', () => {
  const S = state({ version: 1, pending: { toolu_9: spawn() } });
  const reason = activeStop(S);
  for (const part of ['agent-3', 'devils-advocate', 'D-4', 'finished without a captured verdict', 'end the session', 'toolu_9', join(S, 'counters.json'), 'void']) assert.ok(reason.includes(part), part);
});

test('no stop for a closed, void, unfinished spawn or a missing counters.json, and a stop for a malformed one', () => {
  assert.equal(activeStop(state({ version: 1, pending: { a: spawn({ closed_at: 't' }), b: spawn({ void: true }), c: spawn({ finished_at: undefined }) } })), null);
  assert.match(activeStop(state(null)), /^stop guard: counters\.json of the active run is missing/);
  assert.match(activeStop(state('{ "x": ')), /^stop guard: counters\.json of the active run is not readable/);
  assert.equal(activeStop(state({ version: 1 })), null);
});

const RUN = 'RUN-20261106-1';
const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks');

function world({ counters, pointer, runJson } = {}) {
  const base = tempDir('cdp6-stopfor-');
  const w = { base, repo: join(base, 'repo'), data: join(base, 'data') };
  w.S = join(w.data, 'runs', RUN);
  mkdirSync(w.repo, { recursive: true });
  mkdirSync(w.S, { recursive: true });
  const phases = {};
  for (const p of PHASES) phases[p] = { state: 'pending', cycle: 1 };
  writeFileSync(join(w.S, 'run.json'), runJson ?? JSON.stringify({ run_id: RUN, status: 'active', mode: 'single', root: w.repo, run_dir: join(w.repo, 'docs', 'cdp6', 'runs', RUN), journal_offset: 0, phases }));
  writeFileSync(join(w.data, 'active-runs.json'), pointer ?? JSON.stringify({ sessions: { 'sess-1': { run_id: RUN, project_root: w.repo } }, projects: { [w.repo]: RUN } }));
  if (counters !== null) writeFileSync(join(w.S, 'counters.json'), counters ?? JSON.stringify({ version: 1, pending: {} }));
  return w;
}

const look = (w) => stopFor({ session_id: 'sess-1', cwd: w.repo }, { CLAUDE_PLUGIN_DATA: w.data });

test('fires: missing counters.json of an active run is no stop', () => {
  assert.match(look(world({ counters: null })), /^stop guard: counters\.json of the active run is missing/);
  assert.match(look(world({ counters: '{ "x": ' })), /not readable/);
  assert.equal(look(world()), null);
});

test('fires: unreadable run pointer is no stop', () => {
  assert.match(look(world({ pointer: '{ "x": ' })), /active-runs\.json is not readable/);
});

test('fires: unreadable run.json is no stop', () => {
  assert.match(look(world({ runJson: '{ "run_id": ' })), /^run\.json of the active run is not readable/);
});

test('a stop entry of an unbound agent denies with its agent id, its role and no task, and a void entry does not', () => {
  const entry = { agent_type: 'cdp6-core:devils-advocate', finished_at: '2026-11-06T10:00:00.000Z' };
  const w = world({ counters: JSON.stringify({ version: 1, pending: {}, stops: { 'agent-5': entry } }) });
  const reason = look(w);
  for (const part of ['agent-5', 'devils-advocate', 'no bound spawn', 'finished without a captured verdict', 'agent-5 void', join(w.S, 'counters.json')]) assert.ok(reason.includes(part), part);
  assert.equal(look(world({ counters: JSON.stringify({ version: 1, pending: {}, stops: { 'agent-5': { ...entry, void: true } } }) })), null);
  assert.match(look(world({ counters: JSON.stringify({ version: 1, stops: [] }) })), /not readable/);
});

test('no stop without an active run or without an absolute data directory', () => {
  const w = world();
  assert.equal(stopFor({ session_id: 'sess-1', cwd: w.base }, { CLAUDE_PLUGIN_DATA: join(w.base, 'none') }), null);
  assert.equal(stopFor({ session_id: 'sess-1', cwd: w.repo }, {}), null);
  assert.equal(stopFor({ session_id: 'sess-1', cwd: w.repo }, { CLAUDE_PLUGIN_DATA: 'data' }), null);
});

test('fires: guard with its own run lookup', () => {
  for (const guard of ['guard-shell.mjs', 'guard-phase.mjs', 'guard-spawn.mjs']) {
    const source = readFileSync(join(HOOKS, guard), 'utf8');
    assert.match(source, /stopFor/, guard);
    assert.doesNotMatch(source, /findRun|activeStop|uncapturedFinished/, guard);
  }
});
