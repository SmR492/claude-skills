---
name: worker-ack
description: A delegated verification goes to review-verify, which receives the worker contract and opens its answer with the acknowledgement line.
expected_outcome: Claude spawns cdp5-agents:review-verify; the agent's answer starts with "contract: v2 <hash>" and confirms the claim with file and line.
tags: [agents, contract, hooks]
max_turns: 12
timeout_seconds: 420
---
Use the review-verify agent of the cdp5-agents plugin to verify this claim against the repository in the working directory at its HEAD commit: "README.md states that Node.js 20 or later is required." The claim's author is the user. Disposable environment: none. Report the agent's verdict with its evidence, and quote the first line of the agent's answer verbatim.
