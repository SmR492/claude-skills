import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpServer, TOOLS } from '../src/mcp-server.mjs';
import { Engine } from '../src/engine.mjs';

// CDP5-Gates als read-only MCP-Tools (cdp5__*) — die T1-Skills des cdp5-gates-Plugins über den
// nsai-edge-Server. Reine Detektoren/Reports: kein Write, kein Hub-Push (READ_ONLY_TOOLS).

const server = (onWrite) => new McpServer({ engine: new Engine(), onWrite });
const call = (s, name, args) => s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
const callJson = (s, name, args) => JSON.parse(call(s, name, args).result.content[0].text);

const CDP5_TOOLS = [
  'cdp5__lint_concept', 'cdp5__lint_mcp_config', 'cdp5__scaffold_tests_from_ac',
  'cdp5__scan_pii_text', 'cdp5__scan_secrets_text', 'cdp5__scan_pii_repo', 'cdp5__scan_secrets_repo',
  'cdp5__find_test_gaps', 'cdp5__lint_wiki', 'cdp5__map_concept', 'cdp5__check_roadmap_drift',
  'cdp5__check_retro_loop', 'cdp5__check_profile',
];

test('tools/list enthält alle cdp5__-Tools mit inputSchema', () => {
  const s = server();
  const tools = s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools;
  const names = tools.map((t) => t.name);
  for (const n of CDP5_TOOLS) assert.ok(names.includes(n), `${n} muss gelistet sein`);
  // jedes cdp5-Tool trägt ein objekt-typisiertes inputSchema (MCP-Pflicht, claude.ai-strict)
  for (const t of tools.filter((x) => x.name.startsWith('cdp5__'))) {
    assert.equal(t.inputSchema.type, 'object', `${t.name} inputSchema.type=object`);
    assert.ok(typeof t.description === 'string' && t.description.length > 0);
  }
});

test('cdp5__lint_mcp_config erkennt ein Cleartext-Secret (🔴, deterministisch)', () => {
  const s = server();
  const cfg = JSON.stringify({ mcpServers: { foo: { command: 'node', env: { API_KEY: 'abcdef1234567890ABCDEF' } } } });
  const r = callJson(s, 'cdp5__lint_mcp_config', { config_text: cfg });
  assert.equal(r.hasCritical, true);
  assert.ok(r.findings.some((f) => f.sev === '🔴' && /Cleartext-Secret/.test(f.issue)));
});

test('cdp5__scan_secrets_text findet einen AWS-Key redigiert (kein Klartext)', () => {
  const s = server();
  const r = callJson(s, 'cdp5__scan_secrets_text', { text: 'const k = "AKIAIOSFODNN7EXAMPLE";', file: 'snippet.js' });
  const aws = r.findings.find((f) => f.type === 'AWS-Access-Key');
  assert.ok(aws, 'AWS-Key gefunden');
  assert.equal(aws.file, 'snippet.js');
  assert.doesNotMatch(aws.match, /AKIAIOSFODNN7EXAMPLE/, 'Fund ist redigiert (nie Klartext)');
});

test('cdp5__scan_pii_text findet eine E-Mail redigiert', () => {
  const s = server();
  const r = callJson(s, 'cdp5__scan_pii_text', { text: 'Kontakt: max.mustermann@firma.de' });
  assert.ok(r.findings.some((f) => f.type === 'E-Mail'));
  assert.ok(r.findings.every((f) => !/mustermann@firma/.test(f.match)), 'redigiert');
});

test('cdp5__scan_secrets_repo scannt ein lokales Verzeichnis', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cdp5-secrets-'));
  try {
    writeFileSync(join(dir, 'leak.js'), 'export const token = "AKIAIOSFODNN7EXAMPLE";\n');
    writeFileSync(join(dir, 'clean.js'), 'export const x = 1;\n');
    const s = server();
    const r = callJson(s, 'cdp5__scan_secrets_repo', { repo_root: dir });
    assert.equal(r.hasSecrets, true);
    assert.ok(r.scanned >= 2);
    assert.ok(r.findings.some((f) => f.type === 'AWS-Access-Key' && f.file === 'leak.js'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cdp5__find_test_gaps findet ungetestete sicherheitskritische Klasse', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cdp5-gap-'));
  try {
    writeFileSync(join(dir, 'PostVoter.php'), '<?php class PostVoter extends Voter {}');
    const s = server();
    const r = callJson(s, 'cdp5__find_test_gaps', { repo_root: dir });
    assert.ok(r.gaps.some((g) => g.class === 'PostVoter'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cdp5__check_profile meldet Drift, wenn die EU-AI-Act-Klasse im Konzept fehlt', () => {
  const s = server();
  const profile_text = '---\nproject: Demo\neu_ai_act_class: high-risk\n---\n';
  const r = callJson(s, 'cdp5__check_profile', { profile_text, konzept_text: 'Ein Konzept ohne Compliance-Angaben.' });
  assert.equal(r.profile.eu_ai_act_class, 'high-risk');
  assert.equal(r.drift, true);
  assert.ok(r.results.some((x) => x.scope === 'Konzept' && !x.pass));
});

test('cdp5__check_profile ohne konzept_text/repo_root → isError', () => {
  const s = server();
  const r = call(s, 'cdp5__check_profile', { profile_text: '---\nproject: X\n---\n' });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /konzept_text oder repo_root/);
});

test('cdp5__lint_concept ohne konzept_text → INVALID_PARAMETER_FORMAT (kein Crash)', () => {
  const s = server();
  const r = call(s, 'cdp5__lint_concept', {});
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /INVALID_PARAMETER_FORMAT/);
});

test('cdp5-Tools sind read-only: onWrite/Hub-Push feuert NICHT (Bridge unberührt)', () => {
  let writes = 0;
  const s = server(() => { writes++; });
  // mehrere read-only cdp5-Calls
  callJson(s, 'cdp5__lint_mcp_config', { config_text: '{"mcpServers":{}}' });
  callJson(s, 'cdp5__scan_pii_text', { text: 'a@b.de' });
  callJson(s, 'cdp5__scaffold_tests_from_ac', { konzept_text: '## UC-1: X\n| AC-1 | tut etwas | Foo::testIt |\n' });
  assert.equal(writes, 0, 'kein cdp5-Tool darf onWrite auslösen');
  // Positive Control: ein echter (gültiger) Write feuert onWrite
  callJson(s, 'graph__store_triple', { subject: 'ModuleA', predicate: 'depends_on', object: 'ModuleB', confidence: 900 });
  assert.equal(writes, 1, 'graph__store_triple löst onWrite aus (Positive Control)');
});

test('cdp5__lint_wiki erkennt Broken-Link in einem lokalen Wiki', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cdp5-wiki-'));
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.md'), '---\ntitle: Index\ntype: page\nupdated: 2026-01-01\n---\n[tot](./fehlt.md)\n');
    const s = server();
    const r = callJson(s, 'cdp5__lint_wiki', { wiki_root: dir });
    assert.ok(r.brokenLinks.some((b) => b.target === './fehlt.md'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
