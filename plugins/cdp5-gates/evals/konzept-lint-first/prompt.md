---
name: konzept-lint-first
description: A readiness question about a concept document runs konzept-lint before any judgment.
expected_outcome: Claude runs konzept-lint.mjs on docs/konzept.md, reports the open gate items and does not declare the concept ready.
tags: [gates, t1, concept]
max_turns: 8
timeout_seconds: 240
---
Is docs/konzept.md ready for implementation? Give me the gate result and what is still open.
