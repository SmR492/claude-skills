import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKILL = new URL('./konzept-const-sync.mjs', import.meta.url).pathname;
const REAL_KONZEPT = new URL('../../../../nsai-edge/KONZEPT.md', import.meta.url).pathname;
const REAL_SPEC = new URL('../../../../nsai-edge/src/rules.mjs', import.meta.url).pathname;
const REAL_CONFORMANCE = new URL('../../../../nsai-edge/src/conformance.mjs', import.meta.url).pathname;

// Minimal-Spec, deren Skalen die echte rules.mjs spiegeln (für hermetische Fixture-Tests).
const SPEC_SRC = `export const DEFAULT_SPEC = {
  sourceTier: { gesetz: 6, behoerde: 5, sensor: 4, fachquelle: 3, manual: 2, web: 1, llm: 0, inference: 0, default: 0 },
  quorumTrustRank: { untrusted: 0, limited: 500, full: 1000, authoritative: 1500 },
  decayPerPeriod: { eternal: 0, stable: 5, temporal: 50, ephemeral: 200 },
  quorumAuthFloor: 4500, quorumMulti: 2000, deleteThreshold: 50, quarantineThreshold: 300,
  contestedThreshold: 150, beliefSharpness: 3, reinforceDelta: 50,
  recallProtectionDays: 30, recallDecayDivisor: 2,
  demoteLimitedThreshold: 500, demoteUntrustedThreshold: 800, trustAdjustMinEvidence: 5,
};`;

function fixture(konzeptText, specText = SPEC_SRC) {
  const dir = mkdtempSync(join(tmpdir(), 'kcs-'));
  const kPath = join(dir, 'KONZEPT.md');
  const sPath = join(dir, 'rules.mjs');
  writeFileSync(kPath, konzeptText);
  writeFileSync(sPath, specText);
  return { dir, kPath, sPath };
}
const cleanup = (dir) => { try { rmSync(dir, { recursive: true, force: true }); } catch {} };
const run = (args) => spawnSync('node', [SKILL, ...args], { encoding: 'utf8' });

test('AC-1: korrekte Annotationen + Skala → Exit 0', () => {
  const { dir, kPath, sPath } = fixture(
    'tier-Skala: gesetz(6), behoerde(5), web(1). Quorum: full(1000) × behoerde(5) = 5000 ≥ AUTH_FLOOR=4500.');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`]);
  cleanup(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('AC-2: K1-Repro — falsche sourceTier-Deklaration → Exit 1', () => {
  // genau der Z1035-Bug: behoerde=4 statt 5, sensor=1 statt 4, web=2 statt 1.
  const { dir, kPath, sPath } = fixture(
    'tier ∈ {0..6} (llm=0, sensor=1, web=2, fachquelle=3, behoerde=4, gesetz=5)');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`]);
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /behoerde=4/);
  assert.match(r.stdout, /sensor=1/);
  assert.match(r.stdout, /web=2/);
});

test('AC-3: K2-Repro — annotierte Arithmetik falsch → Exit 1', () => {
  // full(1000) × fachquelle(3) = 4500 ist falsch (3000); genau der Z1047-Bug.
  const { dir, kPath, sPath } = fixture(
    'single-auth: full(1000) × fachquelle(3) = 4500 erreicht AUTH_FLOOR.');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`]);
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /arithmetic/);
  assert.match(r.stdout, /korrekt: 3000/);
});

test('AC-4: Phantom-Tier `audit=6` in Tier-Enumeration → Exit 1', () => {
  const { dir, kPath, sPath } = fixture(
    'tier: llm=0, web=1, manual=2, fachquelle=3, sensor=4, behoerde=5, gesetz=6, audit=6');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`]);
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /phantom/);
  assert.match(r.stdout, /audit/);
});

test('AC-5: reine Arithmetik `1000 × 3 = 4500` falsch → Exit 1', () => {
  const { dir, kPath, sPath } = fixture('Beispiel: 1000 × 3 = 4500.');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`]);
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /korrekt: 3000/);
});

test('AC-6: Annotations-Mismatch `full(999)` → Exit 1', () => {
  const { dir, kPath, sPath } = fixture('trustRank: full(999).');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`]);
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /full\(999\).*1000/);
});

test('AC-7: quorum-Domäne gewinnt — authoritative(1500) ok, authoritative(1000) Drift', () => {
  const ok = fixture('authoritative(1500) ist der Quorum-Rang.');
  const r1 = run([`--konzept=${ok.kPath}`, `--spec=${ok.sPath}`]);
  cleanup(ok.dir);
  assert.equal(r1.status, 0, r1.stdout);

  const bad = fixture('authoritative(1000) wäre die trustFactor-Skala, NICHT der Quorum-Rang.');
  const r2 = run([`--konzept=${bad.kPath}`, `--spec=${bad.sPath}`]);
  cleanup(bad.dir);
  assert.equal(r2.status, 1);
  assert.match(r2.stdout, /authoritative\(1000\).*1500/);
});

test('AC-8: Decay-‰-Deklaration falsch (`stable = 9 ‰`) → Exit 1', () => {
  const { dir, kPath, sPath } = fixture('Decay-Tabelle: stable = 9 ‰, temporal = 50 ‰.');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`]);
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /stable 9‰/);
});

test('AC-9: fehlendes --konzept → Exit 2 mit Usage', () => {
  const r = run(['--spec=/tmp/x.mjs']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage/);
});

test('AC-10: Spec ohne DEFAULT_SPEC-Export → Exit 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kcs-'));
  const kPath = join(dir, 'KONZEPT.md'); const sPath = join(dir, 'rules.mjs');
  writeFileSync(kPath, 'leer'); writeFileSync(sPath, 'export const NOPE = {};');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`]);
  cleanup(dir);
  assert.equal(r.status, 2);
});

test('AC-11: JSON-Modus liefert maschinelles Format', () => {
  const { dir, kPath, sPath } = fixture('behoerde=4');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`, '--json']);
  cleanup(dir);
  const out = JSON.parse(r.stdout);
  assert.equal(out.findings.length >= 1, true);
  assert.equal(out.findings[0].kind, 'tier-decl');
});

test('AC-12: conformance-Spiegel-Drift wird erkannt', () => {
  const { dir, kPath, sPath } = fixture('alles korrekt: gesetz(6).');
  const cPath = join(dir, 'conformance.mjs');
  writeFileSync(cPath, 'export const QUORUM_CONSTANTS = { quorumAuthFloor: 9999, quorumMulti: 2000 };');
  const r = run([`--konzept=${kPath}`, `--spec=${sPath}`, `--conformance=${cPath}`]);
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /mirror/);
  assert.match(r.stdout, /9999/);
});

test('AC-13 (Regression-Lock): die ECHTE KONZEPT.md ist nach dem K1/K2-Fix drift-frei', () => {
  const r = run([`--konzept=${REAL_KONZEPT}`, `--spec=${REAL_SPEC}`, `--conformance=${REAL_CONFORMANCE}`]);
  assert.equal(r.status, 0, `Drift in der echten KONZEPT.md:\n${r.stdout}`);
});
