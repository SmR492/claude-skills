---
name: cdp5-reference
description: The CDP5 doctrine as a queryable reference. Returns exactly the required doctrine excerpt by § number or keyword (instead of the whole 2000-line file) — just-in-time retrieval. Use when you need a CDP5 rule/paragraph (e.g. "§32.9", "Lethal Trifecta", "Threat-Modeling", "TDD-First"), or as the mandatory pre-step before agent tasks.
---

# cdp5-reference

The complete CDP5 doctrine (`konzept-design-pattern-v5.md`) is bundled here. Instead of loading it in full, you fetch **exactly** the relevant part — context-efficient (CDP5 §28.6).

## Query

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-reference/cdp5.mjs" --section=33.1
node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-reference/cdp5.mjs" --keyword="lethal trifecta"
node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-reference/cdp5.mjs" --list
```

- `--section=<X>` — the section including its subsections (`33`, `33.1`, `32.8`, `19.4`, `0.3` …).
- `--keyword=<term>` — all blocks whose heading/text contains the term, with a snippet.
- `--list` — table of contents of all sections.
- `--doctrine=<path>` — alternative doctrine file (default: the bundled one).

Exit: `0` hit · `1` no hit · `2` usage error.

## Without Bash

Agents without Bash read/grep the bundled `konzept-design-pattern-v5.md` directly (Read/Grep). The `§` anchors are stable; the part headings structure the reading order (part 0 mission · 1 core principles · 2 workflow · 3 security · 4 authoring · 5 LLM · 6 lessons learned).
