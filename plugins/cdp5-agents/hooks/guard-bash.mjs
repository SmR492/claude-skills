#!/usr/bin/env node
// PreToolUse guard for shell commands of the plugin subagents (Bash and PowerShell tools).
// Judgment agents: allowlist of read-only programs and git read subcommands; everything else is denied. They have no
// network: untrusted repository content plus secrets plus egress is the lethal trifecta, so curl is not on the list.
// Implementation workers: git is limited to worktree-local subcommands; commit, push, fetch, history rewrites and
// remote effects (gh pr merge, curl -X POST, ...) are denied.
// The guard is a tripwire against ordinary write forms, not a sandbox: the disposable environment the brief names is the boundary.
// Fails closed: any error or unparseable input exits 2 (the hook runner shows the reason and blocks).
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { agentName, PLUGIN_PREFIXES } from '../lib/agent-name.mjs';
import { activeGrant, grantApplies } from '../lib/grants.mjs';

export { agentName, PLUGIN_PREFIXES };
export const WRITING_WORKERS = new Set(['impl-debug', 'impl-uc', 'impl-refactor']);
export const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

const GIT_GLOBAL_WITH_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix', '--config-env']);
const GIT_GLOBAL_FLAGS = /^(-p|--paginate|-P|--no-pager|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs|--bare|--no-optional-locks|--html-path|--man-path|--info-path)$/;
// git -c for judgment agents: display keys only. core.pager executes its value, so only known pagers are accepted.
const GIT_CONFIG_KEY_OK = /^(core\.pager|core\.quotepath|color\.[a-z]+|log\.decorate|diff\.noprefix)$/;
const GIT_PAGER_OK = /^(|cat|less|more|head|tail|true|false)$/;
// Options that make a read subcommand write a file or open an editor, in any tier.
const GIT_OUTPUT_OPTS = /^(--output(=.*)?|-O.*|--open-files-in-pager(=.*)?)$/;

export const GIT_READ = new Set(['diff', 'log', 'show', 'status', 'rev-parse', 'ls-files', 'blame', 'grep', 'describe', 'cat-file', 'for-each-ref', 'ls-tree', 'rev-list', 'shortlog', 'name-rev', 'merge-base', 'count-objects', 'check-ignore', 'check-attr', 'var', 'version', 'help', 'whatchanged', 'range-diff', 'diff-tree', 'diff-index', 'diff-files']);
const BRANCH_LIST_FLAGS = /^(-a|-r|-v|-vv|-l|--list|--all|--remotes|--verbose|--show-current|--format=.*|--sort=.*|--column(=.*)?|--no-column|--color(=.*)?|--no-color|-i|--ignore-case|--abbrev=\d+|--no-abbrev)$/;
const BRANCH_FILTER_WITH_VALUE = /^(--contains|--no-contains|--merged|--no-merged|--points-at)$/;

function branchListOnly(args) {
  // git branch lists with flags only; a bare positional creates a branch unless it is the value of a filter option
  // or a pattern after --list.
  const listing = args.includes('--list');
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (BRANCH_FILTER_WITH_VALUE.test(a)) { if (args[i + 1] && !args[i + 1].startsWith('-')) i++; continue; }
    if (/^(--contains|--no-contains|--merged|--no-merged|--points-at)=.+$/.test(a)) continue;
    if (BRANCH_LIST_FLAGS.test(a)) continue;
    if (!a.startsWith('-') && listing) continue;
    return false;
  }
  return true;
}

const GIT_READ_WITH_RESTRICTED_ARGS = {
  branch: branchListOnly,
  tag: (args) => args.length === 0 || args.every((a) => /^(-l|--list|-n\d*|--contains|--points-at|--sort=.*|--format=.*|[^-].*)$/.test(a)) && !args.some((a) => /^(-a|-d|-f|-s|-m|-F|-u|--delete|--force|--sign|--annotate|--message)$/.test(a)) && (args.includes('-l') || args.includes('--list') || args.length === 0 || args.every((a) => a.startsWith('-'))),
  stash: (args) => args[0] === 'list' || args[0] === 'show',
  worktree: (args) => args[0] === 'list',
  remote: (args) => args.length === 0 || args[0] === '-v' || args[0] === 'show' || args[0] === 'get-url',
  config: (args) => args.some((a) => /^(--get|--get-all|--get-regexp|--list|-l|--show-origin)$/.test(a)) && !args.some((a) => /^(--add|--unset|--unset-all|--replace-all|--edit|-e|--remove-section|--rename-section)$/.test(a)) && !(args.filter((a) => !a.startsWith('-')).length >= 2),
  reflog: (args) => args.length === 0 || args[0] === 'show',
  submodule: (args) => args[0] === 'status' || args[0] === 'summary',
  notes: (args) => args.length === 0 || args[0] === 'list' || args[0] === 'show',
};
export const GIT_WORKER_WRITE = new Set(['add', 'rm', 'mv', 'restore', 'checkout', 'switch', 'apply']);
const GIT_WORKER_RESTRICTED = {
  worktree: (args) => ['list', 'add'].includes(args[0]),
  bisect: (args) => ['start', 'good', 'bad', 'old', 'new', 'skip', 'reset', 'run', 'log', 'view', 'visualize', 'terms', 'replay'].includes(args[0]),
  stash: (args) => args[0] === 'list' || args[0] === 'show',
  checkout: (args) => !args.some((a) => /^(-b|-B|--orphan|--track|-t)$/.test(a)),
  switch: (args) => !args.some((a) => /^(-c|-C|--orphan|--create|--force-create)$/.test(a)),
};

export const READ_ONLY_PROGRAMS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'ls', 'wc', 'stat', 'file', 'du', 'df', 'echo', 'printf', 'pwd', 'which', 'whereis', 'type',
  'diff', 'cmp', 'comm', 'sort', 'uniq', 'cut', 'tr', 'jq', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'tree', 'date', 'basename', 'dirname',
  'realpath', 'readlink', 'sha256sum', 'sha1sum', 'md5sum', 'b2sum', 'cksum', 'true', 'false', 'test', '[', 'column', 'nl', 'od', 'xxd', 'strings',
  'hostname', 'uname', 'id', 'whoami', 'nproc', 'free', 'uptime', 'ps', 'cd', 'git', 'find', 'awk', 'sed', 'node', 'php', 'python', 'python3', 'ruby', 'perl', 'wsl', 'bash', 'sh',
  'docker', 'composer', 'npm', 'npx',
]);
const POWERSHELL_READ_ONLY = new Set([
  'get-content', 'get-childitem', 'select-string', 'get-item', 'test-path', 'resolve-path', 'get-location', 'write-output', 'write-host', 'measure-object',
  'select-object', 'where-object', 'foreach-object', 'sort-object', 'format-table', 'format-list', 'out-string', 'compare-object', 'get-filehash', 'convertfrom-json',
  'split-path', 'join-path', 'get-date', 'get-command', 'get-process', 'gc', 'gci', 'sls', 'cat', 'ls', 'dir', 'type', 'echo', 'pwd', 'git', 'wsl', 'node', 'php', 'python', 'python3',
]);
// Cmdlets and aliases that write, delete or execute, matched at command position only: the start of the segment or
// after ; { ( | & = (so README.md is not "md" and "Select-String sc" searches for the text sc).
const POWERSHELL_DENY_WORDS = [
  'out-file', 'set-content', 'add-content', 'remove-item', 'move-item', 'copy-item', 'new-item', 'rename-item', 'clear-content', 'set-item', 'invoke-expression', 'iex',
  'invoke-webrequest', 'invoke-restmethod', 'iwr', 'irm', 'start-process', 'saps', 'stop-process', 'kill', 'new-itemproperty', 'set-itemproperty', 'remove-itemproperty',
  'invoke-command', 'icm', 'invoke-item', 'ii', 'export-csv', 'export-clixml', 'tee-object', 'tee', 'del', 'erase', 'rd', 'rmdir', 'md', 'mkdir', 'ni', 'cp', 'cpi', 'mv', 'mi', 'rm', 'ri',
  'ren', 'rni', 'sc', 'ac', 'sp', 'rp', 'spps', 'start',
];
const POWERSHELL_DENY = new RegExp(`(^|[;{(|&=]\\s*)(${POWERSHELL_DENY_WORDS.join('|')})(?=[\\s;})|]|$)|(^|[;{(|&=]\\s*)(sl|cd|set-location)\\s+hk`, 'i');

// Interpreter options that run inline code, preload a module or change the runtime: short clusters containing one of
// e, p, i, c, r, m, d, E (node -e, perl -pe/-pi, php -r/-d, python -c/-m, ruby -r) and the long forms, with or without =value.
export const INTERPRETER_INLINE = /^(-[a-zA-Z]*[epicrmdE][a-zA-Z]*(=.*)?|--(eval|print|interactive|input-type|import|require|loader|experimental-loader|define|check)(=.*)?)$/;
export const SCRIPT_FILE = /\.(mjs|cjs|js|php|py|rb|pl|sh)$/i;
// Tool scripts a judgment agent may run: the marketplace checkout (plugins/…), an installed plugin (${CLAUDE_PLUGIN_ROOT}/… or
// a path under .claude/plugins/) and a skill script (…/skills/<skill>/<script>). Project binaries (vendor/bin, node_modules/.bin)
// are runs and need a grant.
export const TOOL_SCRIPT_PATH = /^(\.\/)?([^/]+\/)*plugins\/|^\$\{?CLAUDE_PLUGIN_ROOT\}?\/|\/\.claude\/plugins\/|\/skills\/[^/]+\/[^/]+\.(mjs|cjs|js|py|sh)$/;

const SHELL_CFLAG = /^-[a-zA-Z]*c[a-zA-Z]*$/;
const SHELLS = /^(bash|sh|zsh|dash)$/;
// sed: the w (write file) and e (execute) commands, as a command of their own or as an s/// flag.
const SED_WRITE_OR_EXEC = /(^|[\/;{}\s\d$,!])[ewW](\s|$)|\/[gImMp0-9]*[ewW]\b/;
// awk: system(), print/printf to a file or a pipe, getline from a file.
const AWK_SIDE_EFFECT = /\bsystem\s*\(|\bprintf?\b[^;}]*?(>|\|)|\bgetline\s*</;
const CURL_SENDS = /^(-[a-zA-Z]*[XdTF]|--(request|data(-\w+)?|upload-file|form(-string)?|json)(=|$))/;

function tokens(segment) {
  // Whitespace split that keeps quoted strings together and strips the surrounding quotes for inspection.
  const out = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(segment))) out.push({ text: m[1] ?? m[2] ?? m[3], quoted: m[3] === undefined, raw: m[0] });
  return out;
}

export function baseName(text, shell = 'bash') {
  // The program a token names, without quotes, a leading backslash, the directory part and a Windows .exe suffix:
  // \git, /usr/bin/git, "git", gi\t and C:\Git\git.exe all name git.
  let t = String(text ?? '').replace(/^\\/, '').replace(/["']/g, '');
  if (shell === 'powershell' || /^[a-zA-Z]:[\\/]/.test(t) || t.startsWith('\\\\')) t = t.split(/[\\/]/).pop();
  else t = t.replace(/\\(.)/g, '$1').split('/').pop();
  return t.replace(/\.exe$/i, '');
}

export function splitSegments(command) {
  // Splits on newline, ;, &&, ||, | and a single & (background) outside of quotes. Unbalanced quotes throw, which the caller turns into a deny.
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
    if (ch === '&' && s[i + 1] !== '>' && !/[>\d]/.test(s[i - 1] ?? '')) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (quote) throw new Error('unbalanced quotes');
  out.push(cur);
  return out.map((x) => x.replace(/\r$/, '').trim()).filter(Boolean);
}

function configVerdict(kv, literal, tier) {
  // git -c key=value / --config-env=key=ENV for judgment agents: display keys only, no whitespace in the value.
  if (tier !== 'judgment') return null;
  const eq = kv.indexOf('=');
  const key = eq >= 0 ? kv.slice(0, eq) : kv;
  const value = eq >= 0 ? kv.slice(eq + 1) : '';
  if (!GIT_CONFIG_KEY_OK.test(key) || /\s/.test(value)) return `git -c ${key} is not allowed (only pager and colour keys with a plain value)`;
  if (key === 'core.pager' && (!literal || !GIT_PAGER_OK.test(value))) return 'git -c core.pager may only name a known pager';
  return null;
}

function gitVerdict(toks, tier) {
  let i = 1;
  while (i < toks.length && toks[i].text.startsWith('-')) {
    const t = toks[i].text;
    const eq = t.indexOf('=');
    const opt = eq >= 0 ? t.slice(0, eq) : t;
    if (GIT_GLOBAL_WITH_ARG.has(t)) {
      if (t === '-c' || t === '--config-env') {
        const v = configVerdict(toks[i + 1]?.text ?? '', t === '-c', tier);
        if (v) return v;
      }
      i += 2;
      continue;
    }
    if (GIT_GLOBAL_WITH_ARG.has(opt)) {
      if (opt === '-c' || opt === '--config-env') {
        const v = configVerdict(t.slice(eq + 1), opt === '-c', tier);
        if (v) return v;
      }
      i += 1;
      continue;
    }
    if (GIT_GLOBAL_FLAGS.test(t)) { i += 1; continue; }
    return `git option ${t} is not allowed`;
  }
  const sub = toks[i]?.text;
  if (!sub) return null;
  if (toks[i].quoted || /[\\"']/.test(toks[i].raw)) return 'git subcommand with quoting is not allowed';
  const args = toks.slice(i + 1).map((t) => t.text);
  const configAlias = sub === 'config' && args.some((a) => a.startsWith('alias.'));
  if (configAlias) return 'git alias definitions are not allowed';
  const output = args.find((a) => GIT_OUTPUT_OPTS.test(a));
  if (output) return `git ${sub} ${output} writes a file or opens an editor`;
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

function shellInner(toks, shellIdx) {
  // sh [-opts] -c "cmd" (any short cluster containing c) · sh [-opts] script [args] · bare sh reads its script from stdin.
  const cIdx = toks.findIndex((t, k) => k > shellIdx && SHELL_CFLAG.test(t.text));
  if (cIdx >= 0 && toks[cIdx + 1]) return { inner: toks[cIdx + 1].text, kind: 'shell' };
  const script = toks.slice(shellIdx + 1).find((t) => !t.text.startsWith('-'));
  return { inner: null, kind: 'script', script: script ? script.text : '<stdin>' };
}

function innerCommandOf(toks, shell = 'bash') {
  // Returns the inner command of a wrapper (wsl -e bash -c "...", bash -c "...", sh -c "...", docker exec ... <cmd>) or null.
  const first = baseName(toks[0]?.text, shell).toLowerCase();
  if (first === 'wsl') {
    const idx = toks.findIndex((t, k) => k > 0 && (t.text === '-c' || t.text === '--exec' || t.text === '-e'));
    const shellIdx = toks.findIndex((t, k) => k > 0 && SHELLS.test(baseName(t.text)));
    if (shellIdx >= 0) return shellInner(toks, shellIdx);
    if (idx >= 0 && toks[idx + 1]) return { inner: toks.slice(idx + 1).map((t) => t.raw).join(' '), kind: 'shell' };
    return { inner: toks.slice(1).map((t) => t.raw).join(' '), kind: 'shell' };
  }
  if (SHELLS.test(first)) return shellInner(toks, 0);
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

function positionals(args, valued) {
  const out = [];
  for (let k = 0; k < args.length; k++) {
    if (valued.test(args[k])) { k++; continue; }
    if (!args[k].startsWith('-')) out.push(args[k]);
  }
  return out;
}

function remoteEffectVerdict(prog, args) {
  // Remote state changes are denied in every tier: delivery is the diff, publication is the orchestrator's decision.
  if (prog === 'gh') {
    const [a, b] = args;
    if (a === 'pr' && /^(merge|create)$/.test(b ?? '')) return `gh pr ${b} changes the remote repository`;
    if (a === 'release') return 'gh release changes the remote repository';
    if (a === 'repo' && b === 'delete') return 'gh repo delete is not allowed';
    if (a === 'api') {
      const method = /(?:^|\s)(?:-X|--method)[=\s]*(\w+)/.exec(args.join(' '));
      if (method && /^(POST|PUT|DELETE|PATCH)$/i.test(method[1])) return `gh api ${method[1].toUpperCase()} changes remote state`;
      if (args.some((x) => /^(-f|-F|--field|--raw-field|--input)(=|$)/.test(x))) return 'gh api with fields sends a POST request';
    }
  }
  if (prog === 'glab' && args[0] === 'mr' && args[1] === 'merge') return 'glab mr merge changes the remote repository';
  if (prog === 'curl') {
    const sending = args.find((a) => CURL_SENDS.test(a));
    if (sending) return `curl ${sending} sends data or a non-GET request`;
  }
  return null;
}

function readOnlyOptionsVerdict(first, lower, args) {
  // Allowlisted programs whose options write a file or run a program.
  if (lower === 'find' && args.some((a) => /^(-delete|-exec|-execdir|-ok|-okdir|-fprint|-fprintf|-fls)$/.test(a))) return 'find with -delete or -exec is not allowed';
  if (lower === 'sed') {
    if (args.some((a) => /^(-i|--in-place|-s|--separate|-f|--file)/.test(a))) return 'sed in-place editing or a script file is not allowed';
    if (SED_WRITE_OR_EXEC.test(args.join(' '))) return 'sed w (write) and e (execute) commands are not allowed';
  }
  if (lower === 'awk') {
    if (args.some((a) => /^(-f|--file)(=|$)/.test(a))) return 'awk program files are not allowed';
    if (AWK_SIDE_EFFECT.test(args.join(' '))) return 'awk with system(), file output or a pipe is not allowed';
  }
  if (lower === 'sort' && args.some((a) => /^(-[a-zA-Z]*o|--output)/.test(a))) return 'sort -o writes a file';
  if (lower === 'uniq' && positionals(args, /^-(f|s|w)$/).length >= 2) return 'uniq with an output file is not allowed';
  if (lower === 'xxd' && positionals(args, /^-(c|g|l|s|o|cols|len|seek)$/).length >= 2) return 'xxd with an output file is not allowed';
  if (lower === 'tree' && args.some((a) => /^-[a-zA-Z]*o/.test(a))) return 'tree -o writes a file';
  if (lower === 'rg' && args.some((a) => /^--pre(-glob)?(=|$)/.test(a))) return 'rg --pre runs a preprocessor';
  if (lower === 'docker' && !/^(ps|images|inspect|logs|version|info|port|top|stats)$/.test(args[0] ?? '')) return 'only docker read commands are allowed';
  if (lower === 'composer' && !/^(show|info|validate|licenses|outdated|depends|why|why-not|check-platform-reqs|--version|-V)$/.test(args[0] ?? '')) return 'only composer read commands are allowed';
  if (lower === 'npm' || lower === 'npx') {
    if (lower === 'npx' || !/^(ls|list|view|info|show|outdated|audit|--version|-v|explain|why)$/.test(args[0] ?? '')) return `${first} is not allowed for judgment agents`;
    if (args[0] === 'audit' && args.includes('fix')) return 'npm audit fix writes package files';
  }
  if (/^(node|php|python3?|ruby|perl)$/.test(lower)) {
    if (args.length === 1 && /^(--version|-v|-V)$/.test(args[0])) return null;
    const scriptIdx = args.findIndex((a) => !a.startsWith('-'));
    const before = scriptIdx >= 0 ? args.slice(0, scriptIdx) : args;
    const inline = before.find((a) => INTERPRETER_INLINE.test(a));
    if (inline) return `${first} ${inline}: inline code, preloads and runtime options are not allowed; put a probe into a script file in the environment the brief names`;
    const script = scriptIdx >= 0 ? args[scriptIdx] : undefined;
    if (!script || !SCRIPT_FILE.test(script)) return `${first} needs a script file argument`;
    if (!TOOL_SCRIPT_PATH.test(script.replace(/\\/g, '/'))) return `${first} may only run tool scripts under plugins/, \${CLAUDE_PLUGIN_ROOT}/ or a skill directory (got ${script}); test runners and project binaries need a run grant`;
  }
  return null;
}

export function segmentVerdict(segment, tier, shell = 'bash') {
  const toks = tokens(segment);
  if (toks.length === 0) return null;
  const rawFirst = toks[0].raw;
  const first = toks[0].text;
  const lower = baseName(first, shell).toLowerCase();
  if (tier === 'judgment') {
    if (/\$\(|`|<\(|>\(/.test(segment)) return 'command and process substitution are not allowed';
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
    const gi = toks.findIndex((t) => baseName(t.text, shell) === 'git');
    if (gi > 0 && !innerCommandOf(toks, shell)) {
      const v = gitVerdict(toks.slice(gi), tier);
      if (v) return v;
    }
    if (/=\s*git\b/.test(segment)) return 'assigning git to a variable is not allowed';
  }
  if (lower === 'git') return gitVerdict(toks, tier);
  const wrapper = innerCommandOf(toks, shell);
  if (wrapper) {
    if (wrapper.kind === 'script') return tier === 'judgment' ? `running a shell script (${wrapper.script}) is not allowed` : null;
    if (wrapper.container && tier === 'judgment') return 'docker exec/run is not allowed for judgment agents';
    return verdict(wrapper.inner, tier, 'bash');
  }
  const args = toks.slice(1).map((t) => t.text);
  const remote = remoteEffectVerdict(lower, args);
  if (remote) return remote;
  if (tier === 'worker') return null;
  if (shell === 'powershell') {
    if (POWERSHELL_DENY.test(segment)) return 'this PowerShell command writes, deletes or executes';
    if (/\b(-command|-c)\b\s/i.test(segment) && /powershell|pwsh/i.test(first)) return 'nested PowerShell -Command is not allowed';
    if (first === '&' || first === '.') return 'the call operator is not allowed';
    if (!POWERSHELL_READ_ONLY.has(lower)) return `${first} is not in the read-only allowlist`;
  } else if (!READ_ONLY_PROGRAMS.has(lower)) {
    return `${first} is not in the read-only allowlist`;
  }
  return readOnlyOptionsVerdict(first, lower, args);
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
  const granted = Boolean(grant) && grantApplies(grant, input.cwd);
  const tier = isWorker || granted ? 'worker' : 'judgment';
  const shell = input.tool_name === 'PowerShell' ? 'powershell' : 'bash';
  const reason = verdict(command, tier, shell);
  if (!reason) return null;
  let head;
  if (isWorker) head = 'Implementation workers deliver a diff; they do not commit, push, fetch or rewrite history (worker contract rule 8).';
  else if (granted) head = `A run grant is active for ${grant.root}: runs and writes inside it, still no commit, push, fetch or history rewrite (worker contract rule 8).`;
  else if (grant) head = `A run grant exists for another project (${grant.project ?? grant.root}), not for ${input.cwd ?? 'this directory'}; here this agent runs read-only commands only (worker contract rule 8).`;
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
