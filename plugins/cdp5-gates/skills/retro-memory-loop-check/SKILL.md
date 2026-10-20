---
name: retro-memory-loop-check
description: Read-only check whether every memory slug cited in retro/ADR documents (`feedback_x`/`project_x`/`reference_x` in backticks, [[slug]], or a (…slug.md) link) actually exists and is linked from the memory index, and whether every retro either cites a lesson or declares `no new lesson:`. Use on "check retro-memory loop", after retro ADRs, "our lessons are evaporating".
---

# retro-memory-loop-check (CDP5 T1 gate)

Closes the learning loop required by CDP5 §32.6: cited lessons must actually exist, otherwise they evaporate (field finding: retros cited slugs that were never created).

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/retro-memory-loop-check/retro-memory-loop-check.mjs" \
  --retro=<retro-dir> --memory=<memory-dir> [--json]
```

## Severity and exit codes

| Marker | Meaning | Gates? |
|---|---|---|
| 🔴 | blocks — a cited slug has no `<memory>/<slug>.md` file or no link in `MEMORY.md` | yes → exit `1` |
| 🟡 | defect with workaround — a retro cites no slug and has no `no new lesson:` line; or two retro files share a four-digit number | no |
| 🟢 | polish | no (not emitted by this skill today) |

Exit: `0` no 🔴 · `1` ≥1 🔴 · `2` usage or input error (missing argument, path not a directory).
`--json` prints `{ cited, findings[], broken }`; every finding carries `sev` and `kind` (`slug` with `slug`, `fileExists`, `hasPointer`, `sources[]` — or `no-lesson` with `file`, `detail`).

## Checks

1. **Cited slugs** — collected from all `.md` files under `--retro` (symlinks and `.git` skipped). A citation is one of:
   - `[[slug]]` (any slug of `[a-z0-9_-]`),
   - `` `feedback_x` `` / `` `project_x` `` / `` `reference_x` `` in backticks,
   - a markdown link target `(…/feedback_x.md)` / `(project_x.md)` / `(reference_x.md)`.

   Bare words are **not** citations — `project_root` or `reference_count` in prose are identifiers, not memory slugs.
2. **Loop closed** (🔴 otherwise) — for each cited slug: `<memory>/<slug>.md` exists **and** `<memory>/MEMORY.md` contains a markdown link to it (`](…slug.md)`). A bare mention of the slug in `MEMORY.md` does not count as a pointer.
3. **Lesson declared** (🟡 otherwise, §32.6 + pm-retro rule) — a retro file that cites zero slugs must contain a line with `no new lesson:` (case-insensitive) so that "nothing to promote" is an explicit decision, not an omission.
4. **Consecutive numbering** (🟡, §32.6) — two files in the same directory under `--retro` whose names start with the same `NNNN-` prefix break the carry-over chain; renumber, or move the foreign series into its own subdirectory (each directory is one chain). A `NNNN-<slug>.ledger.md` next to `NNNN-<slug>.md` is the retro's ledger, not a second retro. `kind: numbering`, `file` lists both names.

## Limits

- Only `.md` files are read; slugs cited in other formats are not seen.
- A slug cited with a prefix other than `feedback_`/`project_`/`reference_` is only recognised in `[[…]]` form.
