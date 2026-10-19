---
name: retro-memory-loop-check
description: Read-only check whether every memory slug cited in retro/ADR documents (feedback_*/project_*/[[slug]]) actually exists and has a pointer in the memory index. Use on "check retro-memory loop", after retro ADRs, "our lessons are evaporating".
---

# retro-memory-loop-check (CDP5 T1 gate)

Closes the learning loop required by CDP5 §32.6: cited lessons must actually exist, otherwise they evaporate (field finding: retros cited slugs that were never created).

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/retro-memory-loop-check/retro-memory-loop-check.mjs" \
  --retro=<retro-dir> --memory=<memory-dir> [--json]
```

Exit: `0` loop closed · `1` ≥1 cited slug is missing or has no pointer · `2` usage error.

## Check

Collects the slug references (`[[slug]]`, `feedback_x`, `project_x`, `(slug.md)`) from all `.md` files under `--retro`. For each one: does `<memory>/<slug>.md` exist? And does `<memory>/MEMORY.md` contain a pointer? Both are required — otherwise it is a finding.
