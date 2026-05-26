import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUCs, lintKonzept } from './konzept-lint.mjs';

const KOPF = '**Version:** 1.0\n**Scope:** x\n';
const GLOSSAR = '\n## Glossar\n| a | b | c |\n';

test('vollständiges, nicht-LLM-Konzept: kein Struktur-Gap, hoher Teil-Score', () => {
  const md = KOPF +
    '## UC-01: Anlegen\n1. Schritt\n### Fehlerfälle\n| x | y |\n### Akzeptanzkriterien\n| AC-1 | User kann anlegen | Integration | FooTest::testCreate | rot |\n' +
    GLOSSAR;
  const r = lintKonzept(md);
  assert.equal(r.strukturGap, false);
  assert.ok(r.teilScore >= 9.0, `Score ${r.teilScore}`);
});

test('fehlende AC-Tabelle + Fehlerfälle → Struktur-Gap, niedrigerer Score', () => {
  const md = KOPF + '## UC-01: Ohne alles\n1. Schritt\n' + GLOSSAR;
  const r = lintKonzept(md);
  assert.equal(r.strukturGap, true);
  assert.equal(r.perUC[0].hasAC, false);
  assert.ok(r.teilScore < 9.0);
});

test('vage AC-Sprache wird geflaggt (binär/verifizierbar)', () => {
  const md = KOPF +
    '## UC-01: X\n### Fehlerfälle\n| a | b |\n### Akzeptanzkriterien\n| AC-1 | sollte möglichst korrekt sein | Unit | T::t | rot |\n' + GLOSSAR;
  const r = lintKonzept(md);
  assert.ok(r.perUC[0].vagueAC.length >= 1);
  assert.ok(r.dims.ac_binaer < 10);
});

test('LLM-UC ohne §13.1-Felder/Probabilistik → Gap', () => {
  const md = KOPF + '## UC-01: LLM-Klassifikation\nNutzt ein LLM.\n### Fehlerfälle\n|a|b|\n### Akzeptanzkriterien\n| AC-1 | ok | Eval | T::t | rot |\n' + GLOSSAR;
  const r = lintKonzept(md);
  assert.equal(r.global.llm, true);
  assert.equal(r.global.hatProbabilistik, false);
  assert.equal(r.strukturGap, true);
});

test('konfigurierbare Rubrik wird angewandt', () => {
  // UC-01 hat AC-Tabelle, UC-02 nicht → ac_tabelle=5, struktur=10 (differieren)
  const md = KOPF +
    '## UC-01: Mit AC\n### Fehlerfälle\n|a|b|\n### Akzeptanzkriterien\n| AC-1 | binär | Unit | T::t | rot |\n' +
    '## UC-02: Ohne AC\n### Fehlerfälle\n|a|b|\n' + GLOSSAR;
  const a = lintKonzept(md, { struktur: 1, ac_tabelle: 0, fehlerfaelle: 0, ac_binaer: 0, llm_rag: 0 });
  const b = lintKonzept(md, { struktur: 0, ac_tabelle: 1, fehlerfaelle: 0, ac_binaer: 0, llm_rag: 0 });
  assert.equal(a.teilScore, 10);   // struktur voll
  assert.equal(b.teilScore, 5);    // nur 1/2 UCs mit AC
  assert.notEqual(a.teilScore, b.teilScore);
});

test('parseUCs ignoriert Nicht-UC-Überschriften', () => {
  assert.equal(parseUCs('## UC-01: A\nx\n## Glossar\ny\n## UC-02: B\nz').length, 2);
});
