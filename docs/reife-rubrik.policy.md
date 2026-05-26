# Reife-Rubrik (Policy) — CDP5 §10.5 / §4

Verankerte, reproduzierbare Bewertungs-Policy für das **„≥ 9,0/10"-Ziel** aus
[`konzept.md`](konzept.md) §1/§4 (UC-01 „Konzept auf Implementierungsreife prüfen").
Macht den Reife-Score nachvollziehbar statt prosaisch: `konzept-reviewer` (Judgment)
und `konzept-lint` (deterministischer Teil) bewerten gegen diese Gewichte.

## Gewichte (Summe = 1,00)

| # | Dimension | Gewicht | Was sie misst | Score-Quelle |
|---|---|---|---|---|
| 1 | **Sachbearbeiter-Test** (§1.1) | 0,20 | Kann ein geschulter Operator den UC rein aus dem Dokument deterministisch fahren? | Judgment (`konzept-reviewer`) |
| 2 | **Pflicht-Struktur vollständig** (§2) | 0,20 | Kopf/Scope, Rollen, UCs, Artefakte, Probabilistik- + Vendor-Statement, Glossar, Changelog | deterministisch (`konzept-lint`) |
| 3 | **UC-Schritte nummeriert + verzweigt** (§3.0) | 0,15 | Nummerierte Verhalten-Schritte, Verzweigungen sichtbar | deterministisch (`konzept-lint`) |
| 4 | **AC-Tabelle je UC** (§11.7) | 0,15 | Binär/verifizierbare Akzeptanzkriterien, TDD-First-Status | deterministisch (`konzept-lint`) |
| 5 | **Fehlerfälle vollständig** (§3.2) | 0,10 | Fehlerfall-Tabelle je UC, deckt Pflicht-Checkliste | deterministisch (`konzept-lint`) |
| 6 | **Nachweis-Konvention** (§10.7) | 0,10 | Jede Pflicht hat einen Nachweis-Typ (Test/Trace/Metrik) | Judgment + deterministisch |
| 7 | **Glossar / Vokabular** (§14) | 0,10 | Konsistentes Vokabular zwischen Rollen/UCs/Glossar, Anker korrekt | deterministisch (`konzept-lint`) |

**Score** = Σ (Gewicht · Dimensions-Score 0–10). **≥ 9,0 = implementierungsreif.**
Jede „Pflicht" ohne Nachweis-Typ (§10.7) = automatischer Abzug in der betroffenen Dimension.

## Verhältnis zu `konzept-lint`

`konzept-lint` (T1, 0 Modell-Token) deckt den **deterministischen Teil** (Dimensionen 2–5, 7) als
Vorlauf ab und liefert einen Teil-Score; die **Judgment-Dimensionen** (1, 6) bleiben dem
`konzept-reviewer` (opus). Die Gewichte hier sind die Single-Source — das Skill liest sie via
`--rubric=<json>` (Mapping der deterministischen Teilmenge), der Reviewer bewertet das Ganze.

## Verwendung

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/konzept-lint/konzept-lint.mjs" \
  --konzept=docs/konzept.md --rubric=docs/reife-rubrik.policy.json
```

> Diese Markdown-Datei ist die menschenlesbare Policy-Quelle. Eine maschinenlesbare
> `reife-rubrik.policy.json` (nur die deterministische Teilmenge + Gewichte) kann daraus
> abgeleitet und an `konzept-lint --rubric` übergeben werden.
