import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'probe-read.mjs');

function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'probe-read-'));
  try {
    const run = (mode, input, env = {}) => {
      const r = spawnSync('node', [SCRIPT, mode], { input: JSON.stringify(input), encoding: 'utf8', env: { PATH: process.env.PATH, HOME: home, ...env } });
      let lines = [];
      try {
        lines = readFileSync(join(home, '.cache', 'cdp6-probe', 'probe-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      } catch {}
      return { r, lines };
    };
    return fn(home, run);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

const assistant = (id, usage) => JSON.stringify({ type: 'assistant', message: { id, usage } });

test('A-8: usage sums the usage fields of the subagent transcript once per message id', () => {
  withHome((home, run) => {
    const sub = join(home, 'sub.jsonl');
    const main = join(home, 'main.jsonl');
    writeFileSync(sub, [
      assistant('m1', { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 }),
      assistant('m1', { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 }),
      assistant('m2', { input_tokens: 1, output_tokens: 2 }),
      JSON.stringify({ type: 'user', message: { content: 'x' } }),
    ].join('\n'));
    writeFileSync(main, assistant('m9', { input_tokens: 7, output_tokens: 7 }));
    const { r, lines } = run('usage', { hook_event_name: 'SubagentStop', agent_id: 'a1', agent_transcript_path: sub, transcript_path: main });
    assert.equal(r.status, 0);
    assert.equal(lines[0].tag, 'usage');
    assert.equal(lines[0].agent_id, 'a1');
    assert.deepEqual(lines[0].agent, { path: sub, messages: 2, input: 11, output: 7, cacheCreation: 100, cacheRead: 1000 });
    assert.deepEqual(lines[0].main, { path: main, messages: 1, input: 7, output: 7, cacheCreation: 0, cacheRead: 0 });
  });
});

test('fires: an unreadable transcript is logged as an error, not as zero', () => {
  withHome((home, run) => {
    const { r, lines } = run('usage', { hook_event_name: 'SubagentStop', agent_id: 'a1', agent_transcript_path: join(home, 'missing.jsonl') });
    assert.equal(r.status, 0);
    assert.equal(lines[0].agent.error, 'ENOENT');
    assert.equal(lines[0].main, null);
  });
});

test('A-17: mailbox logs every inbox file of the session team before anything consumes it', () => {
  withHome((home, run) => {
    const inboxes = join(home, '.claude', 'teams', 'session-abcdef12', 'inboxes');
    mkdirSync(inboxes, { recursive: true });
    writeFileSync(join(inboxes, 'lead.json'), JSON.stringify([{ from: 'w', text: 'hi', agent_id: 'x' }]));
    writeFileSync(join(inboxes, 'broken.json'), 'not json');
    const { lines } = run('mailbox', { hook_event_name: 'TeammateIdle', session_id: 'abcdef1234567890' });
    assert.equal(lines[0].tag, 'mailbox');
    assert.equal(lines[0].dir, inboxes);
    assert.deepEqual(lines[0].files['lead.json'], [{ from: 'w', text: 'hi', agent_id: 'x' }]);
    assert.equal(lines[0].files['broken.json'], 'not json');
  });
});

test('A-17: a split-pane teammate reads the lead team named by team_name, not its own session', () => {
  withHome((home, run) => {
    const inboxes = join(home, '.claude', 'teams', 'session-0b52ea73', 'inboxes');
    mkdirSync(inboxes, { recursive: true });
    writeFileSync(join(inboxes, 'team-lead.json'), JSON.stringify([{ from: 't1', text: 'idle' }]));
    const { lines } = run('mailbox', { hook_event_name: 'TeammateIdle', session_id: 'b76bdbe8aaaa', team_name: 'session-0b52ea73' });
    assert.equal(lines[0].dir, inboxes);
    assert.deepEqual(lines[0].files['team-lead.json'], [{ from: 't1', text: 'idle' }]);
  });
});

test('A-16: team reads the config of the team named by team_name', () => {
  withHome((home, run) => {
    const dir = join(home, '.claude', 'teams', 'session-0b52ea73');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ members: [{ name: 't1' }] }));
    const { lines } = run('team', { hook_event_name: 'PreToolUse', session_id: 'b76bdbe8aaaa', team_name: 'session-0b52ea73' }, { CDP6_PROBE_ROW: 'A-16' });
    assert.deepEqual(lines[0].members, [{ name: 't1' }]);
  });
});

test('fires: a missing team directory is logged as an error', () => {
  withHome((home, run) => {
    const { lines } = run('mailbox', { hook_event_name: 'TeammateIdle', session_id: 'abcdef1234567890' });
    assert.equal(lines[0].error, 'ENOENT');
  });
});

test('A-22: key logs readable and size only on that row, never the key', () => {
  withHome((home, run) => {
    mkdirSync(join(home, '.config', 'cdp6-core'), { recursive: true });
    writeFileSync(join(home, '.config', 'cdp6-core', 'hook.key'), 'PROBE-KEY-0123456789abcdef');
    assert.equal(run('key', { hook_event_name: 'PreToolUse' }).lines.length, 0);
    const { lines } = run('key', { hook_event_name: 'PreToolUse' }, { CDP6_PROBE_ROW: 'A-22' });
    assert.equal(lines[0].tag, 'key');
    assert.equal(lines[0].readable, true);
    assert.equal(lines[0].bytes, 26);
    assert.equal(JSON.stringify(lines[0]).includes('0123456789abcdef'), false);
  });
});

test('fires: key not present is logged as unreadable with the error code', () => {
  withHome((home, run) => {
    const { lines } = run('key', { hook_event_name: 'PreToolUse' }, { CDP6_PROBE_ROW: 'A-22' });
    assert.equal(lines[0].readable, false);
    assert.equal(lines[0].error, 'ENOENT');
  });
});

test('A-22: marker counts the token occurrences in the session transcript', () => {
  withHome((home, run) => {
    const transcript = join(home, 't.jsonl');
    writeFileSync(transcript, 'a PROBE-MARKER-s1 b\nPROBE-MARKER-s1\nPROBE-MARKER-other\n');
    assert.equal(run('marker', { session_id: 's1', transcript_path: transcript }).lines.length, 0);
    const { lines } = run('marker', { session_id: 's1', transcript_path: transcript }, { CDP6_PROBE_ROW: 'A-22' });
    assert.equal(lines[0].tag, 'marker');
    assert.equal(lines[0].found, true);
    assert.equal(lines[0].count, 2);
    writeFileSync(transcript, 'nothing');
    assert.equal(run('marker', { session_id: 's1', transcript_path: transcript }, { CDP6_PROBE_ROW: 'A-22' }).lines[1].found, false);
  });
});

test('A-16: team logs the members of the session team config at the tool call, on that row only', () => {
  withHome((home, run) => {
    const dir = join(home, '.claude', 'teams', 'session-abcdef12');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ name: 't', members: [{ name: 'p1', agentType: 'cdp6-core:probe' }] }));
    const input = { hook_event_name: 'PreToolUse', session_id: 'abcdef1234567890', agent_type: 'cdp6-core:probe' };
    assert.equal(run('team', input).lines.length, 0);
    const { lines } = run('team', input, { CDP6_PROBE_ROW: 'A-16' });
    assert.equal(lines[0].tag, 'team');
    assert.equal(lines[0].path, join(dir, 'config.json'));
    assert.deepEqual(lines[0].members, [{ name: 'p1', agentType: 'cdp6-core:probe' }]);
  });
});

test('fires: a missing team config is logged as an error, not as an empty members array', () => {
  withHome((home, run) => {
    const { lines } = run('team', { hook_event_name: 'PreToolUse', session_id: 'abcdef1234567890' }, { CDP6_PROBE_ROW: 'A-16' });
    assert.equal(lines[0].error, 'ENOENT');
    assert.equal(lines[0].members, undefined);
  });
});
