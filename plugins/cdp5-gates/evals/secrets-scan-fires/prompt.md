---
name: secrets-scan-fires
description: A pre-push secrets question runs the deterministic scanner and reports its 🔴 finding instead of an eyeball check.
expected_outcome: Claude runs secrets-scan.mjs on the repository and reports the key in config/settings.ini as a blocking finding.
tags: [gates, t1, secrets]
max_turns: 8
timeout_seconds: 240
---
Check this repository for cleartext secrets before I push it. Tell me whether it is safe to push and what you found.
