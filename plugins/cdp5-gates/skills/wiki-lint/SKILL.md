---
name: wiki-lint
description: Read-only Wiki-Health-Check. Deterministische Checks eines Markdown-Wikis — Broken internal Links, Orphan-Pages, Frontmatter-Konsistenz. Use bei „wiki lint", „health check wiki", „broken links prüfen", vor Wiki-Releases.
---

# wiki-lint (CDP5 T1-Gate)

Deterministischer Teil des früheren `wiki-lint`-Agents als Programm. Macht nur die **mechanischen** Checks; stale-claims / Pattern-Promotion / Cross-Ref-Sinn bleiben LLM-/Mensch-Arbeit.

## Aufruf

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/wiki-lint/wiki-lint.mjs" --wiki=<wiki-root> [--json]
```

Exit: `0` keine Broken-Links · `1` ≥1 Broken-Link · `2` Nutzungsfehler.

## Checks

- **Broken internal Links** — `[..](slug.md)`-Ziele relativ zur Datei aufgelöst; `http(s)`/`mailto`/Anker ignoriert.
- **Orphans** — `.md`-Seiten ohne eingehenden Link (Entry-Points `index/overview/log/README/rules.md` ausgenommen).
- **Frontmatter-Konsistenz** — jede Seite braucht YAML-Frontmatter mit `title`, `type`, `updated`.

## Danach (Main-Agent)

Befunde bewerten + fixen (Links reparieren, Orphans verlinken/löschen, stale-claims, Pattern-Promotion) ist Agent-/Mensch-Arbeit.
