---
name: cdp5-reference
description: The CDP5 doctrine as a queryable reference. Returns exactly the required doctrine excerpt by § number or keyword (instead of the whole 2000-line file) — just-in-time retrieval. Use when you need a CDP5 rule/paragraph (e.g. "§32.9", "Lethal Trifecta", "Threat-Modeling", "TDD-First"), or as the mandatory pre-step before agent tasks.
---

# cdp5-reference

The complete CDP5 doctrine (`konzept-design-pattern-v6.md`) is bundled here. Instead of loading it in full, you fetch **exactly** the relevant part — context-efficient (CDP5 §28.6).

## Query

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-reference/cdp5.mjs" --section=33.1
node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-reference/cdp5.mjs" --keyword="lethal trifecta"
node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-reference/cdp5.mjs" --list
```

- `--section=<X>` — the section including its subsections (`33`, `33.1`, `32.8`, `19.4`, `0.3` …). The number must match the heading exactly: `--section=10` returns `## 10. AI Review of the Konzept`, not the combined heading `10.6 / 10.7 / 19 — …` (reachable as `--section=10.6`).
- `--keyword=<term>` — all blocks (headings H1–H4) whose heading/text contains the term (case-insensitive), each with a 200-character snippet.
- `--list` — table of contents (headings up to H3).
- `--doctrine=<path>` — alternative doctrine file (default: the bundled one).

Exit: `0` hit · `2` no hit, or usage/input error. **Reference lookups are not gates:** this skill produces no 🔴/🟡/🟢 findings and never exits `1`; a missing section or keyword is an input problem (typo, wrong number), which is why it shares exit `2` with the usage errors.

## Without Bash

Agents without Bash read/grep the bundled `konzept-design-pattern-v6.md` directly (Read/Grep). The `§` anchors are stable; the part headings structure the reading order (part 0 mission · 1 core principles · 2 workflow · 3 security · 4 authoring · 5 LLM · 6 lessons learned).
