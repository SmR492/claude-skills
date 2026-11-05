# threat-modeler on concept v0.5.22, live P1 run in auto mode and SL-2c (stage-1 run 75): final answer as handed back (summary, threats verbatim in substance)

Brief: `briefs/concept-v0522-tm.md`. contract: v2 f91736a60d15.

Verdict: pass-with-conditions. Auto mode is acceptable for the live P1 run only with one added control: in auto, WebFetch, WebSearch and claude.ai-connector tools are approved by the classifier instead of the owner, and no stage-1 control prevents that egress.

Data flow: owner launch (`--settings`, `--plugin-dir`, `--strict-mcp-config`) → main session in auto; B1 classifier (sees user messages, tool calls, CLAUDE.md; tool results stripped, permission-modes.md:614); Read/Edit in cwd auto-approved without classifier (:590); Bash/Monitor behind B2 sandbox (strictAllowlist, read block; environment inherited, sandboxing.md:34); `run.mjs` behind B3 (excluded, unsandboxed, guard-shell ask and hook token) → `<data>/`; WebFetch/WebSearch/connectors behind B4 classifier only; Agent → guard-spawn → subagent → SubagentHandback behind B5 (check-handback and classifier review, :626); SubagentStop → observe-stop → `finished_at` → stop deny; hooks read the host key behind B6 (deny rules, konzept:1316); preflight read-only.

Auto lets through without a prompt: sandboxed shell, SendMessage, handbacks, WebFetch, WebSearch, MCP calls (classifier, permission-modes.md:595), working-directory edits (:590). Still standing: hook ask (konzept:1697, hooks.md:2009), deny rules in every mode (permission-modes.md:30), sandbox with strictAllowlist, guard-phase, stop guard, record review. None covers B4.

| # | Sev | Concept line | Attack | AC proposal |
|---|---|---|---|---|
| T1 | 🔴 | :1697, :1011 (e) | injected text makes the main session WebFetch with data in the URL or call a connector; in auto only the classifier stands in the way; a repository `WebFetch(domain:)` allow rule skips it (sandboxing.md:776, permission-modes.md:582) | AC-14.13 Unit `preflight.test.mjs` "fires: web or connector egress open in auto": preflight exits 1 without `permissions.deny` WebFetch and WebSearch or `disableClaudeAiConnectors: true` (settings-reference.md:4498) |
| T2 | 🟡 | :1312, :1011 | sandboxed `env` prints inherited secrets (sandboxing.md:34) | AC-14.14 "fires: credential variable in orchestrator environment" unless `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` |
| T3 | 🟡 | :228, :879 | the owner approves a hash he cannot read; a false A-5 auto row admits owner commands | AC-11.22 "fires: A-23 row without handback hook line", "fires: accept reason shows hash only" |
| T4 | 🟡 | :894 | during a stop the session improvises with shell writes or nested `claude -p` | AC-12.36 "fires: shell write during uncaptured stop", "fires: nested claude during stop" |
| T5 | 🟡 | :1011 (e)(f) | the scratch repository's settings or `.mcp.json` add allow rules, hooks or MCP servers | AC-14.15 "fires: repository settings widen the run" |
| T6 | 🟢 | :2249 (Q-21) | bypass only through owner launch flags (permission-modes.md:183) | AC-14.16 "fires: bypass mode not disabled" (`disableBypassPermissionsMode` "disable", settings-reference.md:150, :1164) |
| T7 | 🟢 | :228, :1316 | the same host key MACs hook tokens and probe records without domain separation | AC-11.23 "fires: token MAC accepted as record MAC" |

Answers: `finished_at` cannot be forged or cleared by the model (counters.json behind the Edit deny and denyWrite; only `status` during a stop); the SL-2 guard-phase matcher lacks SendMessage (hooks.json:28), SL-2c adds it (:783); the probe-record reader accepts any 64-character sha256 today (`lib/probe-record.mjs:7`), AC-11.13 covers it; Q-20: adopt the MAC with T3 and T7.

§33.2 checklist: egress allowlist partial (T1); no plaintext secrets partial (T2; `~/.gitconfig` re-opened, settings-reference.md:1085); untrusted responses partial (classifier strips results, reviews handbacks but delivers them, :626; cwd edits not reviewed, :590); diffs checked manually (record review); protections activated partial (T6, T1).

Trifecta: data axis broken in the design (class own, read block, key and transcript denies); egress broken for Bash only. Pass-with-conditions on T1 and T2. Connectors go to mcp-security-reviewer; whether `--strict-mcp-config` suppresses fetched connectors is not stated in the docs copy (inferred).

Residual risk without AC: handback or tool-result injection into unreviewed working-directory edits; the scratch repository's CLAUDE.md reaches the classifier; `observe-stop.mjs` fails open; the A-12 calibration factor is model-transcribed (a wrong value fails closed); approval fatigue until SL-8; the Q-22 skip without a hook line.

Orchestrator check 2026-11-05: permission-modes.md:590, :595, :614, :626; settings-reference.md:82, :150, :1164; sandboxing.md:34, :249 read and matching.
