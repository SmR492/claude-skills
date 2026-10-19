---
name: wiki-lint
description: Read-only wiki health check. Deterministic checks of a Markdown wiki — broken internal .md links, orphan pages, frontmatter consistency. Use on "wiki lint", "health check wiki", "check broken links", before wiki releases.
---

# wiki-lint (CDP5 T1 gate)

The deterministic part of the former `wiki-lint` agent as a program. Performs only the **mechanical** checks; stale claims / pattern promotion / cross-ref meaning remain LLM/human work.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/wiki-lint/wiki-lint.mjs" --wiki=<wiki-root> [--json]
```

## Severity and exit codes

| Marker | Meaning | Gates? |
|---|---|---|
| 🔴 | blocks — broken internal link, missing/incomplete frontmatter | yes → exit `1` |
| 🟡 | defect with workaround — orphan page (reachable by search, not by navigation) | no |
| 🟢 | polish | no (not emitted by this skill today) |

Exit: `0` no 🔴 · `1` ≥1 🔴 · `2` usage or input error (missing `--wiki`, path not a directory).
`--json` prints `{ brokenLinks[], orphans[], frontmatterIssues[], findings[], hasCritical, scanned }`; every entry in `findings` carries `sev`, `kind` (`broken-link` | `frontmatter` | `orphan`), `file`, `detail`.

## Checks

- **Broken internal links** (🔴) — `[..](slug.md)` targets resolved relative to the linking file; `#anchor` suffixes stripped; `http(s)`/`mailto`/pure anchors ignored. **Only `.md` targets are checked** — images, PDFs and other assets are neither validated nor counted as inbound links.
- **Frontmatter consistency** (🔴) — every page needs YAML frontmatter (`---` at the very start) with the keys `title`, `type`, `updated`.
- **Orphans** (🟡) — `.md` pages without an inbound `.md` link from another page (entry points `index/overview/log/README/rules.md` excluded).

Symlinks are not followed; `.git`, `node_modules`, `vendor` etc. are skipped.

## Afterwards (main agent)

Assessing and fixing the findings (repairing links, linking/deleting orphans, stale claims, pattern promotion) is agent/human work.
