---
name: mcp-doc-drift-gate
description: Read-only T1 gate against consumer sycophancy in MCP tools. Loads an MCP server (convention `export const TOOLS = [...]`) via dynamic import and checks, for every tool, that all `inputSchema.properties.*` and all declared `outputContract` fields occur as tokens in the tool `description`. Prevents the hallucination class where an LLM consumer sees an undocumented field and invents its meaning. Use on "mcp doc check", "tool description drift", BEFORE every MCP slice merge.
---

# mcp-doc-drift-gate (CDP5 T1 gate)

## Why

From retro ADR 0016 (NSAI-Edge UC-VPS): when a new output field is introduced **without** the MCP tool description mentioning it, an LLM consumer reads the field in the output, finds no anchor and **invents a meaning**. "Consumer sycophancy" — structurally comparable to classic sycophancy (tests green, hallucination in the output). Stefan's mandate from the daily retro: "prioritise the backlog idea `mcp-doc-drift-gate`".

This skill turns that into a **deterministic** pre-merge gate without any LLM call.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/mcp-doc-drift-gate/mcp-doc-drift-gate.mjs" --mcp=<path-to-mcp-server.mjs> [--json]
```

Exit: `0` no drift · `1` drift found · `2` usage error.

## Convention

The MCP server path must be an ES module and export `TOOLS` as an array (standard pattern in the NSAI-Edge servers):

```js
export const TOOLS = [
  {
    name: 'graph__verify',
    description: '... supported / contradicted / unknown ... physical_status ...',
    inputSchema: { type: 'object', properties: { subject: {...}, predicate: {...}, ... } },
    outputContract: ['verdict', 'contested', 'physical_status'],  // OPTIONAL — if absent: only input drift is checked
  },
];
```

`outputContract` is optional but strongly recommended — it is what makes the gate effective for the ADR-0016 class.

## Checks

1. **Tool shape**: every TOOL has `name`, `description`, `inputSchema`.
2. **Input drift**: every field in `inputSchema.properties` must occur in the description text as a token (case-insensitive substring match on word boundaries).
3. **Output drift** (when `outputContract` is declared): every field must occur in the description.
4. **Whitespace-tolerant**: tokenisation normalises whitespace.

## Example output

```
mcp-doc-drift-gate — 13 tools checked, 2 drift spots

  ✗ graph__verify — Output field `physical_status` not in description
  ✗ graph__search — Input field `max_hops` not in description

2 drift  ·  exit 1
```

## What it does NOT check (deliberate scope boundary)

- Semantic correctness of the description (judgment task → `konzept-reviewer` or similar).
- Completeness of the `outputContract` declaration. If the skill neither finds output drift nor sees an `outputContract`, it prints a **note**, not a fail.
- Wire contract / federation (different skill: `mcp-config-lint`).
