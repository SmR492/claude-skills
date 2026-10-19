---
name: cdp5-init
description: Wires a project's CLAUDE.md to the claude-skills marketplace — idempotently inserts or updates a project-independent marker block (CDP5 reference, cdp5-reference gate, trigger map, skills/agents list). Hybrid: deterministic merge/diff core + interactive confirmation. Use for "wire CLAUDE.md to the marketplace", "cdp5 init", after a fresh install/update of the plugins.
---

# cdp5-init (CDP5 hybrid skill, §32.9)

Closes the gap after a marketplace installation: the `/plugin install` commands wire up skills + agents, but **not** the CLAUDE.md. `cdp5-init` merges a **project-independent** block between `<!-- cdp5:start -->…<!-- cdp5:end -->` (CDP5 reference, **cdp5-reference gate**, trigger map, skills/agents). Running it again = **update** (the block replaces itself, idempotent). Source of the block: `cdp5-block.md`.

**Writes only between the markers, only with `--write`, only after operator confirmation** (the first writing cdp5-gates skill — human responsibility §1.6/§23).

## Interactive flow (driven by the main agent)

1. **Show the diff (read-only):**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-init/cdp5-init.mjs" --target=<CLAUDE.md>
   ```
   Prints the block diff (append or replace), writes nothing.
2. Ask the operator **one yes/no question**: "Apply this block?"
3. **On yes:** apply with `--write` (idempotent marker merge):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-init/cdp5-init.mjs" --target=<CLAUDE.md> --write
   ```
4. **On no:** ask *what* should be adjusted, adjust the block content (keep the invariants: the CDP5 reference **and** the `cdp5-reference` gate must remain — otherwise the core rejects with exit 2), pass it as a file and show the diff again → back to step 2:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-init/cdp5-init.mjs" --target=<CLAUDE.md> --block=<adjusted.md>
   ```
   Loop until "yes" or abort (fallback: the operator edits the CLAUDE.md manually).

## Exit codes (core)

`0` diff shown / written · `2` usage/input error (missing `--target`, directory instead of file, inconsistent marker pair, block without CDP5 reference/gate).

## Limits

Only the merge/diff is deterministic. The content adjustment in step 4 is AI work; its validation is the **repeated deterministic diff + the confirmation** — the AI output is never written unchecked.
