# Brief SL-1 fix 3: file-input audit corrections (stage-1 worker run 24 of cap 45)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02; ledger 0021: adversarial-auditor run 23 blocked fix run 22 with one 🔴; this run closes it). Mandate: "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind."

Output format (final answer, handback only, no file): acknowledgement line; status; per item one row: id, test file and title, red run (command, exit, failing assertion), green run; files changed with line counts; the gate commands with real exits and last output lines; choices between readings with the concept line followed; open questions. Each test red on its own or in a batch no larger than one item. At most 1000 words.

Target state:
- Worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted SL-1 diff. Every Bash call starts with `cd <repo>/.worktrees/sl1 && `, because the agent shell resets the working directory between calls.
- Specification: concept v0.4.12 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, read only): UC-09 step 1.4 (line beginning `   1.4 Path arguments`) and §1.4 item 2 (the sentence on `--git-common-dir`). Previous run: `docs/retro/0021-cdp6-framework/briefs/sl1-fix2.md` and `reports/sl1-fix2.md` (main checkout).

Items (each test-first):
1. 🔴 `lib/input-file.mjs` kernel mode (around line 44 and in `stillSame`): `same` is `real !== null` alone, so after the open an attacker unlinks the hard-linked name, the kernel reports `<path> (deleted)`, a decoy of that name resolves, and the rules pass while the descriptor holds the outside file. Change: in kernel mode also require `sameIdentity(fd, real)` (device and inode), refuse a kernel path ending in ` (deleted)`, and in `stillSame` re-read `fstat(fd).nlink` and refuse unless it is 1. Add the auditor's counter-test as given below, red first.
2. `scripts/run.mjs`: refuse `--intake` and `--assignment` above 1 MiB (`file-too-large`), checked on the descriptor's `fstat` size before the read.
3. `scripts/run.mjs` `cmdInit` (around lines 266-275): refuse when the real path of the run root (nearest existing ancestor of `runsBase`) lies outside the project root for class `own`, or outside `~/.claude/projects/<project>/memory/cdp6/runs/` for class `company` (`run-root-outside`). Test: `docs/cdp6/runs` as a symlink to a directory outside the project.
4. `lib/run-store.mjs` `projectRootOf` (around lines 222-227): use the `--git-common-dir` mapping only when the top-level `.git` of `cwd` is a file whose `gitdir:` names `<common>/worktrees/<name>` and `<common>/worktrees/<name>/gitdir` names that `.git` file back; otherwise return `git rev-parse --show-toplevel` of `cwd`. Tests: a real linked worktree still maps to its main checkout (keep the AC-10.6 worktree tests green); a repository whose `.git/commondir` names another repository's `.git` keeps its own top level.

Counter-test of the adversarial-auditor (run 23; add `linkSync`, `unlinkSync` and whatever else it needs to the imports of `lib/input-file.test.mjs`; adapt helper names, not the assertions):

```js
test('fires: a decoy named "(deleted)" does not pass for an unlinked hard link', () => {
  const base = tree();
  const outside = join(base, 'other', 'secret.txt');
  writeFileSync(outside, 'secret\n');
  const link = join(base, 'real', 'x.txt');
  linkSync(outside, link);
  writeFileSync(`${link} (deleted)`, 'decoy\n');
  const handle = openInput(link, { afterOpen: () => unlinkSync(link) });
  try {
    assert.equal(handle.nlink, 1);
    assert.equal(handle.same && stillSame(handle) && handle.real === `${link} (deleted)`, false);
  } finally {
    closeInput(handle);
  }
});
```

Out of scope: the `statSync`/`readFileSync` gap in `hooks/guard-shell.mjs` around line 25 (a swap there makes `run.mjs` refuse on the hash mismatch, fail closed); the deferred refactor items; everything of later slices; any file outside `plugins/cdp6-core/`; the CDP5 plugins; the concept.

Rules: test-first (write the test, show it red for the reason stated, then implement); a test that cannot turn red is not done. Tests use `node:test`, temporary directories and a temporary HOME; never the real home directory, the real host key or real Claude Code. Key and token bytes never in output or assertion messages. No comments in code. No new dependency. Errors in a structured form without internals. Keep every existing test green.

Gate commands (from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl1
base commit: 27e33269c5e094e290ac38c1b114be6911e1bffa (plus the uncommitted SL-1 diff)
baseline: after fix run 22, cdp6 tests 240/240 and CDP5 suite 295/295 exit 0 (orchestrator re-run 2026-11-03)
run grant: impl-uc may run in <repo>/.worktrees/sl1, 1 use, session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c (expiry in the grant list)

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments and heredocs naming `active-runs.json` or `data-dir`; use Edit and Write for files, or a node script file inside the worktree.

Stop rule: items in order. When an item is not testable as written, contradicts a concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
