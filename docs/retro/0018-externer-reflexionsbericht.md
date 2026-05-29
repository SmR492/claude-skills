# Retro-ADR 0018 — Externer Reflexionsbericht über CDP5 + NSAI-Edge

**Status:** angenommen (Stefan-Auftrag „Halte das als Retro-Feedback fest")
**Datum:** 2026-05-29
**Zweck:** Externe Auswertung der Arbeitsweise (CDP5-Framework + NSAI-Edge-Implementierung) durch einen unabhängigen Reviewer. Nicht slice-spezifisch, sondern eine **Querschnitts-Reflexion** über Methodik, Architektur und Reifegrad nach 17 vorigen Retro-ADRs. Bewusst 1:1 als Sicht von außen festgehalten, damit der Blick eines anderen Reviewers im Retro-Pool erhalten bleibt.

---

## Teil 1 — Methodik-Reflexion: warum CDP5 + NSAI-Edge auf dem richtigen Weg sind

### Größte Stärken

- **Der Adversarial-Audit als eigentlicher Wertschöpfer.** Wichtigste Erkenntnis aus den Retros: „grüne Tests" (100 % Testabdeckung) geben eine **falsche Sicherheit**, weil sie oft nur die Happy Paths oder idealisierte Bedingungen (z. B. nur ASCII-Zeichen) prüfen. Der konsequente Einsatz des `adversarial-auditor` hat kritische Fehlerklassen aufgedeckt — Datenverlust bei Migrationen, Origin-Impersonation, Halluzinationen durch Substring-Matches —, die TDD allein nie gefunden hätte.

- **Strikte Trennung von Determinismus (T1) und Judgment (T2).** Die Entscheidung, klare regide Skripte (T1, 0 Modell-Token) für entscheidbare Aufgaben (`secrets-scan`, `konzept-lint`) als Gatekeeper *vor* die probabilistischen LLM-Agents (T2) zu setzen, macht das System extrem schnell, effektiv und sicher.

- **Klare Leitplanken durch „Stefan's Constraints".** Die strikten Vorgaben (kategorische Verdikte statt Wahrscheinlichkeiten, keine plumpen Halluzinationen, Evidenz-Gewichtung nach Aktualität/Autorität statt nach reiner Anzahl) haben sich als perfekter Filter erwiesen. Sie verhinderten das blinde Übernehmen von fehlerhaftem LLM-fremd-generiertem Code (z. B. Geminis Recursive CTE, das den Determinismus gebrochen hätte).

- **Dogfooding.** Eigene Detektoren (`profile-check`, `konzept-lint`) werden auf die eigenen Repositories angewendet — die billigste und verlässlichste QA, um Dokumentations-Drifts zu finden.

- **Differenzierter Umgang mit Audit-Findings.** Findings werden nicht blind abgearbeitet, sondern klassifiziert: was muss sofort in den Code, was erfordert eine Konzept-Klarstellung, was wird bewusst in einen neuen Slice (#5d, #5b) verschoben.

### Offene Lernfelder

1. **„Concept-First"-Disziplin strikt einhalten.** Retro 0003: tiefe Extraktionen und Multi-Wert-Prädikate wurden programmiert, *bevor* das Konzept angepasst wurde. Auch wenn Änderungen offensichtlich erscheinen — immer zuerst das Konzept (und sei es nur ein Einzeiler) aktualisieren, sonst verliert der CDP5-Loop seinen Beleg-Charakter und Spezifikationen driften.

2. **Prinzipien fixen, nicht Symptome (Whack-a-Mole vermeiden).** In der NSAI-Edge-Qualitäts-Schleife wurden vier Runden lang Punkt-Patches geschrieben, bis erkannt wurde, dass das *generelle Prinzip* (Trust-primäre Präzedenz auf Lese- und Schreibpfaden) fehlte. Wenn ein Bug über mehrere Achsen hinweg auftaucht → sofort nach der invarianten Wurzel suchen.

3. **Test-Design gegen Sycophancy (Zustimmungstendenz) härten.** Tests waren oft blind für komplexe Überschneidungen (Föderations-Fall mit genau einem gewichtslosen Kandidaten; Single-Value- statt Multi-Value-Konstellationen). Zukünftige Tests müssen zwingend End-to-End-Sicherheitsinvarianten und **AC-negative** Fälle abbilden (z. B. gegnerische Substring-Matches), nicht nur Tautologien.

4. **MCP-Tool-Descriptions als Schutz vor Konsumenten-Halluzinationen.** Retro 0016: unzureichend dokumentierte MCP-Tools bergen ein „Consumer-Sycophancy-Risiko" — wenn ein LLM-Konsument ein Output-Feld sieht, das nicht in der Description erklärt ist, erfindet er sich selbst eine (oft falsche) Bedeutung. **Empfehlung:** Backlog-Idee `mcp-doc-drift-gate`-Skill priorisieren — deterministisch prüfen, ob neue Output-Felder zwingend in der Tool-Beschreibung dokumentiert sind.

5. **„Re-Audit" nach Fixes als Pflicht-Standard.** Findings wurden gefixt, dabei wurden aber subtile neue Asymmetrien eingeführt (UTC-Z-Migration: `valid_from/to` asymmetrisch behandelt). Ein bestätigender Reviewer (Sycophancy) winkt das als „gefixt" durch — ein **zweiter** Durchlauf des Adversarial-Audits nach einem Fix sollte standardisierter Prozessschritt sein.

6. **Eigene Security-Tools als Angriffsvektor erkennen.** Retro 0002: ein gieriger Regex im eigenen `secrets-scan` führte bei großen Dateien zu einem ReDoS (~100 s). Sicherheitswerkzeuge, die ungetesteten Code scannen, müssen immer mit Ressourcen-Deckeln (Zeilen-Caps) und streng gebundenen Quantoren ausgestattet sein.

7. **Phase 2: Föderation der PHP-Gegenseite.** Die Node.js-Seite ist extrem reif und funktional, jedoch wartet die Föderations-Sicherheit (P2P / Cross-Language-Bit-Identität) noch auf die Fertigstellung der PHP/Symfony-Gegenseite (`neuro-symbolic-ai-bundle`). Bis HTTP-Transport und PHP-Commands gemerged sind, ist die dezentrale Vertrauenskette nicht vollständig produktionsreif.

### Methodik-Zusammenfassung

Architektur entscheidet sich bewusst für **Determinismus, Nachvollziehbarkeit und harte Leitplanken** — schützt effektiv vor der „Brüchigkeit" klassischer ReAct-Agents. Wenn Concept-First-Disziplin gehalten und Test-Design auf Basis der Adversarial-Erkenntnisse robuster gestaltet wird → exzellenter Weg in Richtung ausgereiftes, neurosymbolisches System.

---

## Teil 2 — Code-Reflexion: GitHub-Repository `SmR492/claude-skills`

Der Code übersetzt die anspruchsvollen Konzepte (Determinismus, harte Security-Gates) pragmatisch und schlank in die Praxis.

### Markante Aspekte

1. **Beeindruckender „Zero-Dependency"-Ansatz.** Der JavaScript-Code (100 % der Codebasis auf der Node-Seite) kommt komplett ohne externe Abhängigkeiten (NPM-Pakete) aus. Alles via Node.js-Builtins — `node:sqlite` für die DB, native Ed25519-Kryptografie. Aus Security-Sicht (Vermeidung Supply-Chain-Attacken) ein massiver Gewinn; extrem wartbar und schnell.

2. **Architektur spiegelt die Methodik perfekt wider.** Strikte Plugin-Trennung:
   - **`cdp5-gates`:** deterministische T1-Skills (`konzept-lint`, `secrets-scan`, `pii-scan`). Rein lesend, parametrisiert, harte Leitplanken.
   - **`cdp5-agents`:** LLM-basierte Methodik-Agenten (`konzept-reviewer`, `adversarial-auditor`). Probabilistisches Judgment auf Basis der deterministischen Vorarbeit.

3. **Radikale Projektunabhängigkeit.** Code im Marketplace konsequent generisch. Eigenes deterministisches Constraint-Gate (per grep) stellt beim Bau sicher, dass keine projektspezifischen Pfade, Namen oder Fixtures leaken. Macht das Repository zum echten, universell teilbaren Werkzeugkasten.

4. **Native Testing-Kultur mit reifem Risikobewusstsein.** Hohe Testdisziplin via nativem `node --test` Runner, TDD-Vorgaben (`ac-to-test-scaffold` Skill). Beeindruckend: die eigene Reflexion, dass **grüne Tests allein oft eine falsche Sicherheit geben** — Verlass auf den `adversarial-auditor` anstatt Unit-Tests blind zu vertrauen.

5. **Eingebaute „Dogfooding"-Robustheit.** Skills wenden ihre eigenen Regeln auf sich selbst an. Strikter Input-Robustheits-Vertrag: bei fehlerhaften Eingaben kein unkontrollierter Stacktrace, sondern saubere Beendigung mit Exit-Code 2 + klare Fehlermeldung. Schützt den Orchestrator vor Fehlerschleifen (Halluzinationen).

### Code-Zusammenfassung

Hervorragendes Beispiel für **Defense in Depth**. Anstatt komplexe Logik in wackelige LLM-Prompts zu pressen, sind die entscheidbaren Probleme in purem, extern-abhängigkeitsfreiem Node.js-Code hart ausprogrammiert. Fundament extrem solide. Wenn in „Phase 2" die PHP/Symfony-Gegenseite auf diesem Qualitätsniveau nachgezogen wird → föderiertes System, das in der Industrie seinesgleichen sucht.

---

## Action-Items, die aus diesem Bericht in die Roadmap einfließen

Diese ADR ist nicht nur Lob/Kritik, sondern **konkreter Auftrag**. Die folgenden Punkte gehen explizit in den Backlog bzw. die laufende Roadmap (R1–R8b nach Tages-Audit):

| Punkt aus Bericht | Roadmap-Item |
|---|---|
| Lernfeld 1 (Concept-First-Disziplin) | als CDP5-Doktrin-Aussage stärken — wird in nächstem Slice explizit angewandt |
| Lernfeld 2 (Prinzipien statt Symptome) | als Meta-Lehre in zukünftige Adversarial-Audits aufnehmen (Suche-Prompt) |
| Lernfeld 3 (Tests gegen Sycophancy) | Test-Schreibhilfe: AC-negative Fälle als CDP5-Pflicht aufnehmen — Backlog |
| Lernfeld 4 (MCP-Tool-Description-Drift) | **explizit als Backlog-Item `mcp-doc-drift-gate`-Skill** — passt zu R4 |
| Lernfeld 5 (Re-Audit nach Fix) | bereits gelebte Praxis (3 Slices hatten 2–3 Audit-Runden); Doktrin schärfen |
| Lernfeld 6 (eigene Security-Tools härten) | Backlog-Item: `secrets-scan` + `pii-scan` mit Zeilen-Caps + bounded Quantoren prüfen |
| Lernfeld 7 (PHP-Phase-2) | **R7 in der aktuellen Roadmap** — Conformance-Vektoren + §G PHP-Parität-Schuld |

## Verlinkung zu existierenden ADRs/Memory

- ADRs 0010–0017 (Slice-Reihe heute): konkrete Belege für jeden Punkt im Bericht.
- ADRs 0001–0009 (Bootstrap + frühe Slices): Quelle der „NSAI-Edge-Qualitäts-Schleife"-Lehre.
- Memory `feedback-green-tests-bypass-security`: deckt sich direkt mit Lernfeld 3.
- Memory `feedback-pushback-welcome`: Begründung für den differenzierten Umgang mit externem Input (auch dieser Bericht selbst).
- Memory `feedback-websearch-in-concept-phase`: passt zu Lernfeld 2 (Recursive CTE verworfen).

## Status der Aufnahme

Bericht wird als externes Reflexionsmaterial im Retro-Pool erhalten. Die Action-Items fließen in die laufende Roadmap (R1–R8b) oder den Backlog ein. Keine direkten Code-Änderungen aus dieser ADR — sie ist Methodik-Spiegel, nicht Slice-Auftrag.
