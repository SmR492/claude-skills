#!/usr/bin/env node
// PreToolUse guard for shell commands of the plugin subagents (Bash and PowerShell tools).
// Judgment agents: allowlist of read-only programs and git read subcommands; everything else is denied.
// Implementation workers: git is limited to worktree-local subcommands; commit, push, fetch and history rewrites are denied.
// The guard is a tripwire against ordinary write forms, not a sandbox: the disposable environment the brief names is the boundary.
// Fails closed: any error or unparseable input exits 2 (the hook runner shows the reason and blocks).
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { agentName, PLUGIN_PREFIXES } from '../lib/agent-name.mjs';
import { activeGrant } from '../lib/grants.mjs';

export { agentName, PLUGIN_PREFIXES };
export const WRITING_WORKERS = new Set(['impl-debug', 'impl-uc', 'impl-refactor']);
export const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

const GIT_GLOBAL_WITH_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix', '--config-env']);
const GIT_GLOBAL_FLAGS = /^(-p|--paginate|-P|--no-pager|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs|--bare|--no-optional-locks|--html-path|--man-path|--info-path)$/;

export const GIT_READ = new Set(['diff', 'log', 'show', 'status', 'rev-parse', 'ls-files', 'blame', 'grep', 'describe', 'cat-file', 'for-each-ref', 'ls-tree', 'rev-list', 'shortlog', 'name-rev', 'merge-base', 'count-objects', 'check-ignore', 'check-attr', 'var', 'version', 'help', 'whatchanged', 'range-diff', 'diff-tree', 'diff-index', 'diff-files', 'ls-remote']);
const GIT_READ_WITH_RESTRICTED_ARGS = {
  branch: (args) => args.every((a) => /^(-a|-r|-v|-vv|--list|--all|--remotes|--verbose|--contains|--merged|--no-merged|--show-current|--format=.*|--sort=.*|[^-].*)$/.test(a)) && !args.some((a) => /^(-d|-D|-m|-M|-f|-c|-C|-u|--delete|--move|--copy|--force|--set-upstream-to|--unset-upstream|--edit-description)$/.test(a)),
  tag: (args) => args.length === 0 || args.every((a) => /^(-l|--list|-n\d*|--contains|--points-at|--sort=.*|--format=.*|[^-].*)$/.test(a)) && !args.some((a) => /^(-a|-d|-f|-s|-m|-F|-u|--delete|--force|--sign|--annotate|--message)$/.test(a)) && (args.includes('-l') || args.includes('--list') || args.length === 0 || args.every((a) => a.startsWith('-'))),
  stash: (args) => args[0] === 'list' || args[0] === 'show',
  worktree: (args) => args[0] === 'list',
  remote: (args) => args.length === 0 || args[0] === '-v' || args[0] === 'show' || args[0] === 'get-url',
  config: (args) => args.some((a) => /^(--get|--get-all|--get-regexp|--list|-l|--show-origin)$/.test(a)) && !args.some((a) => /^(--add|--unset|--unset-all|--replace-all|--edit|-e|--remove-section|--rename-section)$/.test(a)) && !(args.filter((a) => !a.startsWith('-')).length >= 2),
  reflog: (args) => args.length === 0 || args[0] === 'show',
  submodule: (args) => args[0] === 'status' || args[0] === 'summary',
  notes: (args) => args.length === 0 || args[0] === 'list' || args[0] === 'show',
};
export const GIT_WORKER_WRITE = new Set(['add', 'rm', 'mv', 'restore', 'checkout', 'switch', 'apply', 'diff', 'stash']);
const GIT_WORKER_RESTRICTED = {
  worktree: (args) => ['list', 'add'].includes(args[0]),
  stash: (args) => args[0] === 'list' || args[0] === 'show',
  checkout: (args) => !args.some((a) => /^(-b|-B|--orphan|--track|-t)$/.test(a)),
  switch: (args) => !args.some((a) => /^(-c|-C|--orphan|--create|--force-create)$/.test(a)),
};

export const READ_ONLY_PROGRAMS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'ls', 'wc', 'stat', 'file', 'du', 'df', 'echo', 'printf', 'pwd', 'which', 'whereis', 'type',
  'diff', 'cmp', 'comm', 'sort', 'uniq', 'cut', 'tr', 'jq', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'tree', 'date', 'basename', 'dirname',
  'realpath', 'readlink', 'sha256sum', 'sha1sum', 'md5sum', 'b2sum', 'cksum', 'true', 'false', 'test', '[', 'column', 'nl', 'od', 'xxd', 'strings',
  'hostname', 'uname', 'id', 'whoami', 'nproc', 'free', 'uptime', 'ps', 'cd', 'git', 'find', 'awk', 'sed', 'node', 'php', 'python', 'python3', 'ruby', 'perl', 'wsl', 'bash', 'sh',
  'docker', 'composer', 'npm', 'npx', 'curl',
]);
const POWERSHELL_READ_ONLY = new Set([
  'get-content', 'get-childitem', 'select-string', 'get-item', 'test-path', 'resolve-path', 'get-location', 'write-output', 'write-host', 'measure-object',
  'select-object', 'where-object', 'foreach-object', 'sort-object', 'format-table', 'format-list', 'out-string', 'compare-object', 'get-filehash', 'convertfrom-json',
  'split-path', 'join-path', 'get-date', 'get-command', 'get-process', 'gc', 'gci', 'sls', 'cat', 'ls', 'dir', 'type', 'echo', 'pwd', 'git', 'wsl', 'node', 'php', 'python', 'python3',
]);
const POWERSHELL_DENY = /\b(out-file|set-content|add-content|remove-item|move-item|copy-item|new-item|rename-item|clear-content|set-item|invoke-expression|iex|invoke-webrequest|invoke-restmethod|iwr|irm|start-process|saps|stop-process|kill|new-itemproperty|set-itemproperty|remove-itemproperty|invoke-command|icm|set-location\s+hk|export-csv|export-clixml|tee-object|del|erase|rd|rmdir|md|mkdir|ni|cp|mv|rm|ren|rni|sc)\b/i;

export const INTERPRETER_INLINE = /^(-e|-p|-pe|-pi|-i|-r|-c|-m|--eval|--print|--input-type|--import|-r=.*|-E)$/;
export const SCRIPT_FILE = /\.(mjs|cjs|js|php|py|rb|pl|sh)$/i;
export const TOOL_SCRIPT_PATH = /^(\.\/)?([^/]+\/)*(plugins|vendor\/bin|node_modules\/\.bin)\//;

function tokens(segment) {
  // Whitespace split that keeps quoted strings together and strips the surrounding quotes for inspection.
  const out = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(segment))) out.push({ text: m[1] ?? m[2] ?? m[3], quoted: m[3] === undefined, raw: m[0] });
  return out;
}

export function splitSegments(command) {
  // Splits on newline, ;, &&, || and | outside of quotes. Unbalanced quotes throw, which the caller turns into a deny.
  const s = String(command);
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && quote === '"' && i + 1 < s.length) { cur += s[++i]; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '\\' && i + 1 < s.length) { cur += ch + s[++i]; continue; }
    if (ch === '\n' || ch === ';') { out.push(cur); cur = ''; continue; }
    if ((ch === '&' || ch === '|') && s[i + 1] === ch) { out.push(cur); cur = ''; i++; continue; }
    if (ch === '|') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (quote) throw new Error('unbalanced quotes');
  out.push(cur);
  return out.map((x) => x.replace(/\r$/, '').trim()).filter(Boolean);
}

function gitVerdict(toks, tier) {
  let i = 1;
  while (i < toks.length && toks[i].text.startsWith('-')) {
    const t = toks[i].text;
    if (GIT_GLOBAL_WITH_ARG.has(t)) { i += 2; continue; }
    if (GIT_GLOBAL_WITH_ARG.has(t.split('=')[0]) || GIT_GLOBAL_FLAGS.test(t)) { i += 1; continue; }
    return `git option ${t} is not allowed`;
  }
  const sub = toks[i]?.text;
  if (!sub) return null;
  if (toks[i].quoted || /[\\"']/.test(toks[i].raw)) return 'git subcommand with quoting is not allowed';
  const args = toks.slice(i + 1).map((t) => t.text);
  const configAlias = sub === 'config' && args.some((a) => a.startsWith('alias.'));
  if (configAlias) return 'git alias definitions are not allowed';
  if (GIT_READ.has(sub)) return null;
  if (GIT_READ_WITH_RESTRICTED_ARGS[sub]) {
    if (GIT_READ_WITH_RESTRICTED_ARGS[sub](args)) return null;
    if (tier === 'worker' && GIT_WORKER_RESTRICTED[sub]?.(args)) return null;
    return `git ${sub} ${args.join(' ')} is not a read-only form`;
  }
  if (tier === 'worker') {
    if (GIT_WORKER_RESTRICTED[sub]) return GIT_WORKER_RESTRICTED[sub](args) ? null : `git ${sub} ${args.join(' ')} is not allowed for workers`;
    if (GIT_WORKER_WRITE.has(sub)) return null;
    return `git ${sub} is not allowed for workers (no commit, push, fetch or history rewrite; delivery is the diff)`;
  }
  return `git ${sub} is not read-only`;
}

function innerCommandOf(toks) {
  // Returns the inner command string of a wrapper (wsl -e bash -c "...", bash -c "...", sh -c "...", docker exec ... <cmd>) or null.
  const first = toks[0]?.text.toLowerCase();
  if (first === 'wsl') {
    const idx = toks.findIndex((t, k) => k > 0 && (t.text === '-c' || t.text === '--exec' || t.text === '-e'));
    const bashIdx = toks.findIndex((t) => /^(bash|sh|zsh)$/.test(t.text));
    if (bashIdx >= 0) {
      const cIdx = toks.findIndex((t, k) => k > bashIdx && t.text === '-c');
      if (cIdx >= 0 && toks[cIdx + 1]) return { inner: toks[cIdx + 1].text, kind: 'shell' };
      if (toks[bashIdx + 1]) return { inner: null, kind: 'script', script: toks[bashIdx + 1].text };
    }
    if (idx >= 0 && toks[idx + 1]) return { inner: toks.slice(idx + 1).map((t) => t.raw).join(' '), kind: 'shell' };
    return { inner: toks.slice(1).map((t) => t.raw).join(' '), kind: 'shell' };
  }
  if (/^(bash|sh|zsh|dash)$/.test(first)) {
    const cIdx = toks.findIndex((t, k) => k > 0 && t.text === '-c');
    if (cIdx >= 0 && toks[cIdx + 1]) return { inner: toks[cIdx + 1].text, kind: 'shell' };
    if (toks[1]) return { inner: null, kind: 'script', script: toks[1].text };
    return { inner: '', kind: 'shell' };
  }
  if (first === 'docker') {
    const sub = toks[1]?.text;
    if (sub === 'exec' || sub === 'run') {
      let k = 2;
      while (k < toks.length && toks[k].text.startsWith('-')) k += /^(-e|--env|-w|--workdir|-u|--user|--name|-v|--volume|--network|--entrypoint|-p|--publish)$/.test(toks[k].text) ? 2 : 1;
      return { inner: toks.slice(k + 1).map((t) => t.raw).join(' '), kind: 'shell', container: true };
    }
  }
  return null;
}

export function segmentVerdict(segment, tier, shell = 'bash') {
  const toks = tokens(segment);
  if (toks.length === 0) return null;
  const rawFirst = toks[0].raw;
  const first = toks[0].text;
  const lower = first.toLowerCase();
  if (tier === 'judgment') {
    if (/\$\(|`/.test(segment)) return 'command substitution is not allowed';
    if (/\s(eval|exec|source)\s/.test(` ${segment} `) || /^(eval|exec|source|\.)$/.test(lower)) return 'eval, exec and sourcing are not allowed';
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(first)) return 'environment assignments before a command are not allowed';
    if (first.startsWith('$')) return 'a variable as command is not allowed';
    if (/[\\"']/.test(rawFirst) || /^\.?\//.test(first) && !/^\/usr\/bin\/(git|grep|cat|ls)$/.test(first)) return 'quoted, escaped or path-form command names are not allowed';
    // redirections: only to /dev/null, stderr merges allowed
    const redirects = [...segment.matchAll(/(\d?>>?&?\s*\S+|<\S*)/g)].map((m) => m[0]).filter((r) => !/^\d?>&\d$/.test(r.replace(/\s+/g, '')) && !/^\d?>>?\s*\/dev\/null$/.test(r) && !/^</.test(r));
    if (redirects.length) return `output redirection is not allowed (${redirects[0]})`;
  } else if (/`|\$\(.*\bgit\b/.test(segment) && /\bgit\b/.test(segment)) {
    return 'git behind command substitution is not allowed for workers';
  }
  if (/\bgit\b/.test(segment) && lower !== 'git') {
    // git somewhere later in the segment (wrapper, env prefix): inspect that git invocation too
    const gi = toks.findIndex((t) => t.text === 'git');
    if (gi > 0 && !innerCommandOf(toks)) {
      const v = gitVerdict(toks.slice(gi), tier);
      if (v) return v;
    }
    if (/=\s*git\b/.test(segment)) return 'assigning git to a variable is not allowed';
  }
  if (lower === 'git') return gitVerdict(toks, tier);
  const wrapper = innerCommandOf(toks);
  if (wrapper) {
    if (wrapper.kind === 'script') return tier === 'judgment' ? `running a shell script (${wrapper.script}) is not allowed` : null;
    if (wrapper.container && tier === 'judgment') return 'docker exec/run is not allowed for judgment agents';
    return verdict(wrapper.inner, tier, 'bash');
  }
  if (tier === 'worker') return null;
  if (shell === 'powershell') {
    if (POWERSHELL_DENY.test(segment)) return 'this PowerShell command writes, deletes or executes';
    if (/\b(-command|-c)\b\s/i.test(segment) && /powershell|pwsh/i.test(first)) return 'nested PowerShell -Command is not allowed';
    if (first === '&' || first === '.') return 'the call operator is not allowed';
    if (!POWERSHELL_READ_ONLY.has(lower)) return `${first} is not in the read-only allowlist`;
  } else if (!READ_ONLY_PROGRAMS.has(lower)) {
    return `${first} is not in the read-only allowlist`;
  }
  const args = toks.slice(1).map((t) => t.text);
  if (lower === 'find' && args.some((a) => /^(-delete|-exec|-execdir|-ok|-okdir|-fprint|-fprintf|-fls)$/.test(a))) return 'find with -delete or -exec is not allowed';
  if (lower === 'sed' && (args.some((a) => /^(-i|--in-place|-s)/.test(a)) || /(^|\s)w\s/.test(args.join(' ')))) return 'sed in-place or write commands are not allowed';
  if (lower === 'awk' && /system\(|print\s*>|getline\s*</.test(args.join(' '))) return 'awk with system() or file output is not allowed';
  if (lower === 'curl' && args.some((a) => /^(-X|--request|-d|--data|--data-raw|--data-binary|--upload-file|-T|-F|--form|-o|--output|-O|--remote-name|--json)/.test(a))) return 'curl writing or sending data is not allowed';
  if (lower === 'docker' && !/^(ps|images|inspect|logs|version|info|port|top|stats)$/.test(args[0] ?? '')) return 'only docker read commands are allowed';
  if (lower === 'composer' && !/^(show|info|validate|licenses|outdated|depends|why|why-not|check-platform-reqs|--version|-V)$/.test(args[0] ?? '')) return 'only composer read commands are allowed';
  if ((lower === 'npm' || lower === 'npx') && !(lower === 'npm' && /^(ls|list|view|info|show|outdated|audit|--version|-v|explain|why)$/.test(args[0] ?? ''))) return `${first} is not allowed for judgment agents`;
  if (/^(node|php|python3?|ruby|perl)$/.test(lower)) {
    if (args.some((a) => INTERPRETER_INLINE.test(a))) return `${first} with inline code is not allowed; put a probe into a script file in the environment the brief names`;
    const script = args.find((a) => !a.startsWith('-'));
    if (!script || !SCRIPT_FILE.test(script)) return `${first} needs a script file argument`;
    if (!TOOL_SCRIPT_PATH.test(script)) return `${first} may only run tool scripts under plugins/, vendor/bin/ or node_modules/.bin/ (got ${script})`;
  }
  if (lower === 'echo' || lower === 'printf') return null;
  return null;
}

export function verdict(command, tier, shell = 'bash') {
  let segments;
  try {
    segments = splitSegments(command);
  } catch (e) {
    return `command could not be parsed (${e.message})`;
  }
  for (const seg of segments) {
    const v = segmentVerdict(seg, tier, shell);
    if (v) return v;
  }
  return null;
}

export function decide(input, env = process.env) {
  const name = agentName(input.agent_type);
  if (!name) return null;
  if (!SHELL_TOOLS.has(input.tool_name)) return null;
  const command = input.tool_input?.command ?? '';
  const isWorker = WRITING_WORKERS.has(name);
  const grant = isWorker ? null : activeGrant(name, env);
  const tier = isWorker || grant ? 'worker' : 'judgment';
  const shell = input.tool_name === 'PowerShell' ? 'powershell' : 'bash';
  const reason = verdict(command, tier, shell);
  if (!reason) return null;
  let head;
  if (isWorker) head = 'Implementation workers deliver a diff; they do not commit, push, fetch or rewrite history (worker contract rule 8).';
  else if (grant) head = `A run grant is active for ${grant.root}: runs and writes inside it, still no commit, push, fetch or history rewrite (worker contract rule 8).`;
  else head = 'This agent runs read-only commands only; runs need a grant for a disposable environment from the orchestrator (worker contract rule 8).';
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `${head} Blocked: ${reason}. Command: ${String(command).slice(0, 120)}` } };
}

export function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch (e) {
    process.stderr.write(`cdp5-agents guard: unreadable hook input (${e.message}); failing closed\n`);
    return 2;
  }
  try {
    const out = decide(input, process.env);
    if (out) process.stdout.write(JSON.stringify(out));
    return 0;
  } catch (e) {
    process.stderr.write(`cdp5-agents guard: internal error (${e.message}); failing closed\n`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
