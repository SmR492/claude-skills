---
name: wiki-lint
description: Read-only wiki health check. Deterministic checks of a Markdown wiki — broken internal links, orphan pages, frontmatter consistency. Use on "wiki lint", "health check wiki", "check broken links", before wiki releases.
---

# wiki-lint (CDP5 T1 gate)

The deterministic part of the former `wiki-lint` agent as a program. Performs only the **mechanical** checks; stale claims / pattern promotion / cross-ref meaning remain LLM/human work.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/wiki-lint/wiki-lint.mjs" --wiki=<wiki-root> [--json]
```

Exit: `0` no broken links · `1` ≥1 broken link · `2` usage error.

## Checks

- **Broken internal links** — `[..](slug.md)` targets resolved relative to the file; `http(s)`/`mailto`/anchors ignored.
- **Orphans** — `.md` pages without an inbound link (entry points `index/overview/log/README/rules.md` excluded).
- **Frontmatter consistency** — every page needs YAML frontmatter with `title`, `type`, `updated`.

## Afterwards (main agent)

Assessing and fixing the findings (repairing links, linking/deleting orphans, stale claims, pattern promotion) is agent/human work.
