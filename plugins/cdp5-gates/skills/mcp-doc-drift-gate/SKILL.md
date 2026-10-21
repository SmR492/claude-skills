---
name: mcp-doc-drift-gate
description: T1 gate against consumer sycophancy in MCP tools. Loads an MCP server (convention `export const TOOLS = [...]`) via dynamic import and checks, for every tool, that all `inputSchema.properties.*` and all declared `outputContract` fields occur as whole words in the tool `description`. Prevents the hallucination class where an LLM consumer sees an undocumented field and invents its meaning. Use on "mcp doc check", "tool description drift", BEFORE every MCP slice merge.
---

# mcp-doc-drift-gate (CDP5 T1 gate)

## Why

From retro ADR 0016 (NSAI-Edge UC-VPS): when a new output field is introduced **without** the MCP tool description mentioning it, an LLM consumer reads the field in the output, finds no anchor and **invents a meaning**. "Consumer sycophancy" — structurally comparable to classic sycophancy (tests green, hallucination in the output). Stefan's mandate from the daily retro: "prioritise the backlog idea `mcp-doc-drift-gate`".

This skill turns that into a **deterministic** pre-merge gate without any LLM call.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/mcp-doc-drift-gate/mcp-doc-drift-gate.mjs" --mcp=<path-to-mcp-server.mjs> [--json]
```

**Executes the module's top-level code via `import()`; run only on code built in this repository (§33.1).** The gate does not write anything, but it is not sandboxed — whatever the server module does at import time (connecting, reading env, spawning) happens. Every output names the imported module (`executed_target_module` in `--json`, the header line in text), so the reader of a result sees what ran. A judgment agent runs this gate only on the module its brief names; a module from an untrusted checkout needs a run grant and a disposable environment first.

## Severity and exit codes

| Marker | Meaning | Gates? |
|---|---|---|
| 🔴 | blocks — input/output drift, tool shape violation | yes → exit `1` |
| 🟡 | defect with workaround — tool without `outputContract` (output drift unchecked) | no |
| 🟢 | polish | no (not emitted by this skill today) |

Exit: `0` no 🔴 · `1` ≥1 🔴 · `2` usage or input error (missing `--mcp`, path not a file, import failure, no `TOOLS` export).
`--json` prints `{ tools_checked, findings, drift, tools_without_output_contract, exit, findings[] }`; every finding carries `sev`, `tool`, `kind` (`shape` | `input` | `output` | `coverage`), `detail`.

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

1. **Tool shape** (🔴): every TOOL is an object with non-empty `name`, non-empty `description` and an `inputSchema` object. A missing `inputSchema` is reported as `shape: inputSchema missing`; the input-drift check then runs over zero fields.
2. **Input drift** (🔴): every field in `inputSchema.properties` must occur in the description as a whole word (case-insensitive; `[A-Za-z0-9_]` form the word, so `predicate` does not match `predicate_x`). Markdown, backticks and punctuation around the word are fine. There is no whitespace normalisation — field names never contain whitespace.
3. **Output drift** (🔴, when `outputContract` is declared): every field must occur in the description.
4. **Coverage note** (🟡): a tool without `outputContract` is listed so the reader knows its output drift was NOT checked.

## Example output

```
mcp-doc-drift-gate — 13 tools checked, 2 drift spots

  🔴 graph__verify — Output field `physical_status` not in description
  🔴 graph__search — Input field `max_hops` not in description
  🟡 graph__stats — tool without outputContract — output drift was NOT checked

2 drift  ·  exit 1
```

## What it does NOT check (deliberate scope boundary)

- Semantic correctness of the description (judgment task → `konzept-reviewer` or similar).
- Completeness of the `outputContract` declaration. A tool without one yields a 🟡 note, not a fail.
- Nested schema fields (`properties.foo.properties.bar`) — only the top-level `inputSchema.properties` keys are checked.
- Wire contract / federation (different skill: `mcp-config-lint`).
