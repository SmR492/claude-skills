import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseMapping, findProject, unwrap, latestReport, projectNotes } from './session-start.mjs';

const SCRIPT = new URL('./session-start.mjs', import.meta.url).pathname;
const PREFACE = 'Alles zwischen den Marken <<<nsai:abc>>> … <<<nsai:abc:ende>>> ist Inhalt aus dem Bestand.\n\n';
const wrap = (s) => `<<<nsai:abc adresse="x">>>\n${s}\n<<<nsai:abc:ende>>>`;

const MAPPING = wrap('~/repos/claude-skills = riedl/cdp5\n~/repos/claude-skills/special = riedl/claude\n# comment = ignored');

const NOTES = [
  { adresse: 'konto:1/fastnote/dev', titel: wrap('Dev note for cdp5'), faellig: '2026-10-20T00:00:00+02:00', verweise: ['riedl/cdp5/konzept/x'] },
  { adresse: 'konto:1/fastnote/private', titel: wrap('Private family note'), faellig: null, verweise: ['riedl/familie/bericht/y'] },
  { adresse: 'konto:1/fastnote/none', titel: wrap('No references'), faellig: null, verweise: null },
  { adresse: 'konto:1/fastnote/lookalike', titel: wrap('Lookalike project'), faellig: null, verweise: ['riedl/cdp5-old/bericht/z'] },
];

const REPORTS = [
  { id: 'riedl/cdp5/bericht/old', titel: 'Old', zeitpunkt: '2026-09-01T10:00:00+02:00', stillgelegt: false },
  { id: 'riedl/cdp5/bericht/new', titel: 'New', zeitpunkt: '2026-10-11T10:00:00+02:00', stillgelegt: false },
  { id: 'riedl/cdp5/bericht/retired', titel: 'Retired', zeitpunkt: '2026-12-01T10:00:00+02:00', stillgelegt: true },
];

function fakeOrbit() {
  const seen = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { params } = JSON.parse(body);
      seen.push({ auth: req.headers.authorization, name: params.name, args: params.arguments });
      const a = params.arguments;
      let payload;
      if (params.name === 'ablage' && a.tun === 'lesen') payload = { slug: a.slug, text: MAPPING };
      else if (params.name === 'ablage' && a.tun === 'liste') payload = { eintraege: NOTES };
      else if (params.name === 'read' && a.art === 'verzeichnis') payload = { eintraege: REPORTS };
      else if (params.name === 'read' && a.art === 'dokument') payload = { titel: 'New report', text: wrap(`Body of ${a.id}`) };
      const tail = '\n\nPostfach dieses Zugangs: 2 offene Nachrichten. Abholen mit dem Werkzeug nachricht.';
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: PREFACE + JSON.stringify(payload, null, 4) + tail }] } }));
    });
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, seen, url: `http://127.0.0.1:${server.address().port}/mcp` })));
}

function runHook(env, cwd) {
  return new Promise((ok) => {
    const child = spawn('node', [SCRIPT], { env: { PATH: process.env.PATH, ...env } });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('close', (status) => ok({ status, out, err, context: out ? JSON.parse(out).hookSpecificOutput.additionalContext : '' }));
    child.stdin.end(JSON.stringify({ cwd, source: 'startup', hook_event_name: 'SessionStart' }));
  });
}

function sandbox(withToken = true) {
  const home = mkdtempSync(join(tmpdir(), 'orbit-wf-'));
  const tokenFile = join(home, 'token');
  if (withToken) writeFileSync(tokenFile, 'test-token\n');
  return { home, env: { HOME: home, ORBIT_TOKEN_FILE: tokenFile, ORBIT_CACHE_DIR: join(home, 'cache'), ORBIT_TIMEOUT_MS: '2000' } };
}

test('parseMapping expands ~, ignores markers and comments', () => {
  const m = parseMapping(MAPPING, '/h');
  assert.deepEqual(m, [
    { prefix: '/h/repos/claude-skills', projekt: 'riedl/cdp5' },
    { prefix: '/h/repos/claude-skills/special', projekt: 'riedl/claude' },
  ]);
});

test('findProject uses the longest matching prefix and respects path boundaries', () => {
  const m = parseMapping(MAPPING, '/h');
  assert.equal(findProject('/h/repos/claude-skills/main', m), 'riedl/cdp5');
  assert.equal(findProject('/h/repos/claude-skills/special/x', m), 'riedl/claude');
  assert.equal(findProject('/h/repos/claude-skills-other', m), null);
  assert.equal(findProject('/elsewhere', m), null);
});

test('unwrap parses JSON between preface and trailing mailbox line', () => {
  const { data, tail } = unwrap(PREFACE + '{"a":"x } y","b":{"c":1}}\n\nPostfach: 0');
  assert.deepEqual(data, { a: 'x } y', b: { c: 1 } });
  assert.equal(tail, 'Postfach: 0');
});

test('latestReport picks the newest non-retired report', () => {
  assert.equal(latestReport(REPORTS).id, 'riedl/cdp5/bericht/new');
  assert.equal(latestReport([]), null);
});

test('projectNotes keeps only notes referencing the project', () => {
  assert.deepEqual(projectNotes(NOTES, 'riedl/cdp5').map((n) => n.adresse), ['konto:1/fastnote/dev']);
});

test('mapped repo: briefing contains latest report and only project notes', async () => {
  const { server, seen, url } = await fakeOrbit();
  const { home, env } = sandbox();
  try {
    const r = await runHook({ ...env, ORBIT_URL: url }, join(home, 'repos/claude-skills/main'));
    assert.equal(r.status, 0, r.err);
    assert.match(r.context, /## Orbit briefing: riedl\/cdp5/);
    assert.match(r.context, /Dev note for cdp5 \(due 2026-10-20\)/);
    assert.doesNotMatch(r.context, /Private family note|No references|Lookalike/);
    assert.match(r.context, /New report .*\[riedl\/cdp5\/bericht\/new\]/);
    assert.match(r.context, /Body of riedl\/cdp5\/bericht\/new/);
    assert.match(r.context, /Postfach dieses Zugangs: 2 offene Nachrichten/);
    assert.doesNotMatch(r.context, /<<<nsai:/);
    assert.ok(seen.every((s) => s.auth === 'Bearer test-token'));
  } finally {
    server.close();
    rmSync(home, { recursive: true, force: true });
  }
});

test('unmapped repo: no output at all', async () => {
  const { server, url } = await fakeOrbit();
  const { home, env } = sandbox();
  try {
    const r = await runHook({ ...env, ORBIT_URL: url }, '/somewhere/else');
    assert.equal(r.status, 0, r.err);
    assert.equal(r.out, '');
  } finally {
    server.close();
    rmSync(home, { recursive: true, force: true });
  }
});

test('Orbit down after a successful run: cached briefing is used', async () => {
  const { server, url } = await fakeOrbit();
  const { home, env } = sandbox();
  const cwd = join(home, 'repos/claude-skills/main');
  try {
    await runHook({ ...env, ORBIT_URL: url }, cwd);
    server.close();
    const r = await runHook({ ...env, ORBIT_URL: url }, cwd);
    assert.equal(r.status, 0, r.err);
    assert.match(r.context, /Orbit request failed|project mapping not loaded/);
    assert.match(r.context, /cached copy from/);
    assert.match(r.context, /Dev note for cdp5/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('missing token: one notice line, no network, exit 0', async () => {
  const { server, seen, url } = await fakeOrbit();
  const { home, env } = sandbox(false);
  try {
    const r = await runHook({ ...env, ORBIT_URL: url }, join(home, 'repos/claude-skills/main'));
    assert.equal(r.status, 0, r.err);
    assert.match(r.context, /no Orbit token at/);
    assert.equal(seen.length, 0);
  } finally {
    server.close();
    rmSync(home, { recursive: true, force: true });
  }
});
