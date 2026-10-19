#!/usr/bin/env node
// PreToolUse guard for shell commands (Bash and PowerShell tools).
// Plugin subagents:
//   Judgment agents: allowlist of read-only programs and git read subcommands; everything else is denied. They have no
//   network: untrusted repository content plus secrets plus egress is the lethal trifecta, so curl, gh and the network
//   subcommands of npm and composer are not on the list.
//   Implementation workers (and judgment agents with an applying run grant): git is limited to worktree-local
//   subcommands; commit, push, fetch, history rewrites, gh/glab beyond read subcommands and curl sends are denied.
//   No subagent runs the orchestrator tools (grant-run, worktree-setup, generate-contract).
// Main session (no plugin agent type): untouched, except that issuing a run grant asks the human to confirm it.
// The guard is a tripwire against ordinary write forms, not a sandbox: the disposable environment the brief names is the boundary.
// Fails closed: any error or unparseable input exits 2 (the hook runner shows the reason and blocks).
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { agentName, WRITING_WORKERS } from '../lib/agent-name.mjs';
import { activeGrant, grantApplies, sessionMatches } from '../lib/grants.mjs';

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

// Programs a judgment agent may run (after prefix resolution); wrappers (bash, sh, wsl, docker exec) and git are
// handled before this list is consulted.
export const READ_ONLY_PROGRAMS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'ls', 'wc', 'stat', 'file', 'du', 'df', 'echo', 'printf', 'pwd', 'which', 'whereis', 'type',
  'diff', 'cmp', 'comm', 'sort', 'uniq', 'cut', 'tr', 'jq', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'tree', 'date', 'basename', 'dirname',
  'realpath', 'readlink', 'sha256sum', 'sha1sum', 'md5sum', 'b2sum', 'cksum', 'true', 'false', 'test', '[', 'column', 'nl', 'od', 'xxd', 'strings',
  'hostname', 'uname', 'id', 'whoami', 'nproc', 'free', 'uptime', 'ps', 'cd', 'find', 'awk', 'sed', 'node', 'php', 'python', 'python3', 'ruby', 'perl',
  'docker', 'composer', 'npm', 'npx',
]);
const POWERSHELL_READ_ONLY = new Set([
  'get-content', 'get-childitem', 'select-string', 'get-item', 'test-path', 'resolve-path', 'get-location', 'write-output', 'write-host', 'measure-object',
  'select-object', 'where-object', 'foreach-object', 'sort-object', 'format-table', 'format-list', 'out-string', 'compare-object', 'get-filehash', 'convertfrom-json',
  'split-path', 'join-path', 'get-date', 'get-command', 'get-process', 'gc', 'gci', 'sls', 'cat', 'ls', 'dir', 'type', 'echo', 'pwd', 'node', 'php', 'python', 'python3',
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
// PowerShell argument expressions that run .NET or code inside an otherwise read-only cmdlet's arguments.
const POWERSHELL_EXPRESSION = [
  [/\[[A-Za-z_][\w.`]*\]\s*::/, 'a static .NET call'],
  [/\bnew-object\b/i, 'New-Object'],
  [/\[scriptblock\]/i, '[scriptblock]'],
  [/\badd-type\b/i, 'Add-Type'],
  [/(^|\s)-encodedcommand\b/i, '-EncodedCommand'],
  [/\binvoke-[a-z]+/i, 'an Invoke-* cmdlet'],
  [/(^|[\s;{(|=])[&.]\s*\(/, 'the call operator on an expression'],
  [/\([^)]*(::|\bnew-object\b)/i, 'a static call or New-Object in parentheses'],
];

// Interpreter options that run inline code, preload a module or change the runtime: short clusters containing one of
// e, p, i, c, r, m, d, E (node -e, perl -pe/-pi, php -r/-d, python -c/-m, ruby -r) and the long forms, with or without =value.
export const INTERPRETER_INLINE = /^(-[a-zA-Z]*[epicrmdE][a-zA-Z]*(=.*)?|--(eval|print|interactive|input-type|import|require|loader|experimental-loader|define|check)(=.*)?)$/;
export const SCRIPT_FILE = /\.(mjs|cjs|js|php|py|rb|pl|sh)$/i;
// Tool scripts a judgment agent may run: an installed plugin (${CLAUDE_PLUGIN_ROOT}/… or the plugin cache under the
// home directory's .claude/plugins/) and the skill scripts of this marketplace's checkout
// (plugins/<cdp5-gates|cdp5-agents|domain-agents|orbit-workflow>/skills/<skill>/<script>). No .. segments; never the
// orchestrator scripts. Project code (vendor/bin, node_modules/.bin, wp-content/plugins/…) is a run and needs a grant.
export const TOOL_SCRIPT_PATH = /^(\$\{CLAUDE_PLUGIN_ROOT\}|\$CLAUDE_PLUGIN_ROOT|\$env:CLAUDE_PLUGIN_ROOT)\/|^(~|\$\{?HOME\}?|\/home\/[^/]+|\/Users\/[^/]+|\/root|[A-Za-z]:\/Users\/[^/]+)\/\.claude\/plugins\/|^(\.\/)?plugins\/(cdp5-gates|cdp5-agents|domain-agents|orbit-workflow)\/skills\/[^/]+\/[^/]+\.(mjs|cjs|js|py|sh)$/;

// Orchestrator tools: no subagent runs them (they issue grants and create environments).
const ORCHESTRATOR_SCRIPT = /(^|[/=])(grant-run|worktree-setup|generate-contract)\.mjs(?=$|["'\s;&|)])|(^|[/=~])cdp5-agents\/scripts\//;
const ORCHESTRATOR_REASON = 'orchestrator tools; a worker never issues grants or creates environments';
const PLUGIN_STATE = /grants\.json|grants\.lock|usage-log\.jsonl|\.cache[\\/]+cdp5-agents|CLAUDE_PLUGIN_DATA|cdp5-agents[\\/]+(data-dir|session)\b/i;
const PLUGIN_STATE_REASON = "the plugin's state (grants, session and data-dir pointers, usage log) is written only by the orchestrator's scripts and the hooks";
function mentionsPluginState(segment) {
  return PLUGIN_STATE.test(String(segment));
}
// Programs that only display a file named as an argument; they may mention an orchestrator script.
const VIEWERS = new Set(['cat', 'head', 'tail', 'less', 'more', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'wc', 'ls', 'stat', 'file', 'diff', 'cmp', 'sha256sum', 'sha1sum', 'md5sum', 'b2sum', 'cksum', 'git', 'get-content', 'gc', 'select-string', 'sls', 'get-item', 'get-childitem', 'gci', 'test-path', 'get-filehash']);
// Programs that run code read from stdin or from arguments built elsewhere.
const STDIN_RUNNERS = new Set(['node', 'bash', 'sh', 'zsh', 'dash', 'python', 'python3', 'perl', 'ruby', 'php', 'deno', 'bun', 'eval', 'source', '.', 'pwsh', 'powershell']);
// Programs that run another program given as a later argument and are not resolved structurally.
const RUNNERS = new Set(['flock', 'chrt', 'taskset', 'strace', 'ltrace', 'unbuffer', 'chronic', 'parallel', 'script', 'su', 'runuser', 'caffeinate', 'systemd-run', 'firejail', 'chroot', 'nsenter', 'unshare', 'fakeroot', 'proot', 'busybox']);
const REMOTE_PROGRAMS = /^(git|gh|glab|curl)$/;

const SHELL_CFLAG = /^-[a-zA-Z]*c[a-zA-Z]*$/;
const SHELLS = /^(bash|sh|zsh|dash)$/;
// sed: the w (write file) and e (execute) commands, as a command of their own or as an s/// flag.
const SED_WRITE_OR_EXEC = /(^|[\/;{}\s\d$,!])[ewW](\s|$)|\/[gImMp0-9]*[ewW]\b/;
// awk: system(), print/printf to a file or a pipe, getline from a file or from a command (cmd | getline), coprocesses, extensions.
const AWK_SIDE_EFFECT = /\bsystem\s*\(|\bprintf?\b[^;}]*?(>|\|)|\bgetline\s*</;
const AWK_COMMAND_GETLINE = /\|\s*getline\b|\|&|@(load|include)\b/;
const CURL_SENDS = /^(-[a-zA-Z]*[XdTF]|--(request|data(-\w+)?|upload-file|form(-string)?|json)(=|$))/;
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;

export function tokens(segment, shell = 'bash') {
  // Shell words: quoted parts and escapes are joined into one word (text) with the source kept (raw). Bash escapes
  // with a backslash, PowerShell with a backtick (a backslash is a path separator there).
  const s = String(segment);
  const ps = shell === 'powershell';
  const esc = ps ? '`' : '\\';
  const out = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    const start = i;
    let text = '';
    let quoted = false;
    while (i < s.length && !/\s/.test(s[i])) {
      const ch = s[i];
      if (ch === "'") {
        quoted = true;
        const end = s.indexOf("'", i + 1);
        const stop = end < 0 ? s.length : end;
        text += s.slice(i + 1, stop);
        i = stop + 1;
        continue;
      }
      if (ch === '"') {
        quoted = true;
        i++;
        while (i < s.length && s[i] !== '"') {
          if (s[i] === esc && i + 1 < s.length && (ps || /[$`"\\\n]/.test(s[i + 1]))) { text += s[i + 1]; i += 2; continue; }
          text += s[i++];
        }
        i++;
        continue;
      }
      if (ch === esc && i + 1 < s.length) { text += s[i + 1]; i += 2; continue; }
      text += ch;
      i++;
    }
    out.push({ text, quoted, raw: s.slice(start, Math.min(i, s.length)) });
  }
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

export function redirections(segment, shell = 'bash') {
  // Unquoted output redirections of a segment: [{ op, target }]. A > inside quotes is text, not an operator.
  const s = String(segment);
  const ps = shell === 'powershell';
  const out = [];
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (quote === '"' && ch === (ps ? '`' : '\\')) { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === (ps ? '`' : '\\')) { i++; continue; }
    if (ch !== '>') continue;
    let op = '>';
    if (/[0-9&*]/.test(s[i - 1] ?? '')) op = s[i - 1] + op;
    let j = i + 1;
    if (/[>|&]/.test(s[j] ?? '')) op += s[j++];
    while (j < s.length && /[ \t]/.test(s[j])) j++;
    let target = '';
    let q = null;
    for (; j < s.length; j++) {
      const c = s[j];
      if (q) { if (c === q) q = null; else target += c; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (/[\s;|&<>()]/.test(c)) break;
      target += c;
    }
    out.push({ op, target });
    i = j - 1;
  }
  return out;
}

function redirectAllowed({ op, target }, shell) {
  if (/>&$/.test(op) && /^(\d+|-)$/.test(target)) return true; // fd duplication or close: 2>&1, >&2, >&-
  if (target === '/dev/null') return true;
  if (shell === 'powershell' && /^\$null$/i.test(target)) return true;
  return false;
}

function skipOptions(toks, k, withValue) {
  // Skips leading options; those matching withValue consume the next token as their value.
  while (k < toks.length && toks[k].text.startsWith('-') && toks[k].text !== '-') {
    const a = toks[k].text;
    if (a === '--') return k + 1;
    k += withValue && withValue.test(a) ? 2 : 1;
  }
  return k;
}

const PREFIX_PROGRAMS = new Set(['env', 'timeout', 'nice', 'ionice', 'nohup', 'setsid', 'stdbuf', 'command', 'builtin', 'exec', 'time', 'xargs', 'sudo', 'doas', 'watch']);

export function resolveCommand(toks, shell = 'bash') {
  // Strips the prefixes that run the rest of the words as a command (VAR=value, env, timeout, nice, nohup, stdbuf,
  // command, exec, xargs, sudo, watch, ...) and returns the command words, the assignments and the prefixes seen.
  const assignments = [];
  const prefixes = [];
  let viaXargs = false;
  let k = 0;
  const n = toks.length;
  while (k < n) {
    const t = toks[k];
    if (shell === 'powershell') {
      if (t.text === '&' || t.text === '.') { prefixes.push(t.text); k++; continue; }
      if (/^\$[\w:]+$/.test(t.text) && toks[k + 1]?.text === '=') { assignments.push(`${t.text.slice(1)}=${toks[k + 2]?.text ?? ''}`); k += 2; continue; }
      break;
    }
    if (ASSIGNMENT.test(t.raw)) { assignments.push(t.text); k++; continue; }
    const name = t.quoted ? '' : baseName(t.text, shell).toLowerCase();
    if (!PREFIX_PROGRAMS.has(name)) break;
    prefixes.push(name);
    k++;
    switch (name) {
      case 'env':
        while (k < n) {
          const a = toks[k].text;
          if (/^(-S|--split-string)/.test(a) || /^-[a-zA-Z]*S/.test(a) && !a.startsWith('--')) return { error: 'env -S (split string) is not allowed', toks: [], assignments, prefixes, viaXargs };
          if (/^(-u|--unset|-C|--chdir)$/.test(a)) { k += 2; continue; }
          if (a === '--') { k++; break; }
          if (a.startsWith('-')) { k++; continue; }
          if (ASSIGNMENT.test(a)) { assignments.push(a); k++; continue; }
          break;
        }
        break;
      case 'timeout': k = skipOptions(toks, k, /^(-s|--signal|-k|--kill-after)$/) + 1; break;
      case 'nice': k = skipOptions(toks, k, /^(-n|--adjustment)$/); break;
      case 'ionice': k = skipOptions(toks, k, /^(-c|--class|-n|--classdata|-p|--pid|-P|--pgid|-u|--uid)$/); break;
      case 'stdbuf': k = skipOptions(toks, k, /^(-i|-o|-e|--input|--output|--error)$/); break;
      case 'exec': k = skipOptions(toks, k, /^-a$/); break;
      case 'time': k = skipOptions(toks, k, /^(-f|--format|-o|--output)$/); break;
      case 'sudo': k = skipOptions(toks, k, /^(-u|--user|-g|--group|-C|--close-from|-D|--chdir|-h|--host|-p|--prompt|-r|--role|-t|--type|-U|--other-user|-T|--command-timeout)$/); break;
      case 'doas': k = skipOptions(toks, k, /^(-u|-C)$/); break;
      case 'watch': k = skipOptions(toks, k, /^(-n|--interval|-q|--equexit)$/); break;
      case 'xargs': viaXargs = true; k = skipOptions(toks, k, /^(-I|-n|-L|-P|-s|-d|-E|-a|--arg-file|--delimiter|--max-args|--max-lines|--max-procs|--max-chars|--eof|--replace|--process-slot-var)$/); break;
      default: k = skipOptions(toks, k, null);
    }
  }
  return { toks: toks.slice(k), assignments, prefixes, viaXargs };
}

function assignsRemoteProgram(assignment) {
  const value = assignment.slice(assignment.indexOf('=') + 1).trim();
  const firstWord = value.split(/\s+/)[0] ?? '';
  return REMOTE_PROGRAMS.test(baseName(firstWord).toLowerCase());
}

function mentionsOrchestratorScript(toks) {
  return toks.some((t) => ORCHESTRATOR_SCRIPT.test(t.text.replace(/\\/g, '/')) || ORCHESTRATOR_SCRIPT.test(t.raw.replace(/\\+/g, '/').replace(/["']/g, '')));
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

const PUBLICATION = "publication is the orchestrator's";

function remoteEffectVerdict(prog, args) {
  // gh and glab: read subcommands only, in every tier; curl: no sending. Delivery is the diff.
  if (prog === 'gh') {
    const [a, b] = args;
    if (args.length === 1 && /^(--version|version)$/.test(a)) return null;
    if (a === 'auth' && b === 'status') return null;
    if (/^(pr|issue|repo|release|run|workflow)$/.test(a ?? '') && /^(view|list|status|diff|checks)$/.test(b ?? '')) return null;
    if (a === 'api') {
      const method = /(?:^|\s)(?:-X|--method)[=\s]*(\w+)/.exec(args.join(' '));
      if (method && !/^GET$/i.test(method[1])) return `gh api ${method[1].toUpperCase()} changes remote state; ${PUBLICATION}`;
      if (args.some((x) => /^(-[fF]|--field|--raw-field|--input)/.test(x))) return `gh api with fields or input sends a POST request; ${PUBLICATION}`;
      if (b === 'graphql') return `gh api graphql sends a POST request; ${PUBLICATION}`;
      return null;
    }
    return `gh ${[a, b].filter(Boolean).join(' ')} is not a read subcommand; ${PUBLICATION}`;
  }
  if (prog === 'glab') {
    const [a, b] = args;
    if (args.length === 1 && /^(--version|-v|version)$/.test(a)) return null;
    if (a === 'auth' && b === 'status') return null;
    if (/^(mr|issue|repo|release|ci)$/.test(a ?? '') && /^(view|list|status|diff)$/.test(b ?? '')) return null;
    return `glab ${[a, b].filter(Boolean).join(' ')} is not a read subcommand; ${PUBLICATION}`;
  }
  if (prog === 'curl') {
    const sending = args.find((a) => CURL_SENDS.test(a));
    if (sending) return `curl ${sending} sends data or a non-GET request`;
  }
  return null;
}

function longOptionIs(arg, name, minChars = 1) {
  // GNU long options accept unambiguous prefixes: --in, --outp=x.
  if (!arg.startsWith('--')) return false;
  const given = arg.slice(2).split('=')[0];
  return given.length >= minChars && name.startsWith(given);
}

function shortCluster(arg, letters, valueLetters) {
  // True when a short option cluster (-ni, -Ei) contains one of letters before a letter that takes a value.
  if (!/^-[a-zA-Z]/.test(arg)) return false;
  for (const ch of arg.slice(1)) {
    if (letters.includes(ch)) return true;
    if (valueLetters.includes(ch) || !/[a-zA-Z]/.test(ch)) return false;
  }
  return false;
}

function readOnlyOptionsVerdict(first, lower, args) {
  // Allowlisted programs whose options write a file, run a program or reach the network.
  if (lower === 'find' && args.some((a) => /^-(delete|exec|execdir|ok|okdir|fprint\w*|fls)$/.test(a))) return 'find with -delete, -exec or a file output (-fprint*, -fls) is not allowed';
  if (lower === 'sed') {
    if (args.some((a) => shortCluster(a, 'isf', 'el') || longOptionIs(a, 'in-place') || longOptionIs(a, 'separate', 2) || longOptionIs(a, 'file', 2))) return 'sed in-place editing or a script file is not allowed';
    if (SED_WRITE_OR_EXEC.test(args.join(' '))) return 'sed w (write) and e (execute) commands are not allowed';
  }
  if (lower === 'awk' || lower === 'gawk') {
    if (args.some((a) => /^(-f|--file|-E|--exec|-i|--include|-l|--load)(=|$)/.test(a) || /^-[fEil]./.test(a))) return 'awk program files, includes and extensions are not allowed';
    const program = args.join(' ');
    if (AWK_SIDE_EFFECT.test(program) || AWK_COMMAND_GETLINE.test(program)) return 'awk with system(), file output, a pipe or command getline is not allowed';
  }
  if (lower === 'sort' && args.some((a) => shortCluster(a, 'o', 'ktST') || longOptionIs(a, 'output') || longOptionIs(a, 'compress-program', 2))) return 'sort -o writes a file and --compress-program runs a program';
  if (lower === 'uniq' && positionals(args, /^-(f|s|w)$/).length >= 2) return 'uniq with an output file is not allowed';
  if (lower === 'xxd' && positionals(args, /^-(c|g|l|s|o|cols|len|seek)$/).length >= 2) return 'xxd with an output file is not allowed';
  if (lower === 'tree' && args.some((a) => /^-[a-zA-Z]*o/.test(a) || /^--output(=|$)/.test(a))) return 'tree -o writes a file';
  if (lower === 'rg' && args.some((a) => /^--pre(-glob)?(=|$)/.test(a))) return 'rg --pre runs a preprocessor';
  if (lower === 'docker' && !/^(ps|images|inspect|logs|version|info|port|top|stats)$/.test(args[0] ?? '')) return 'only docker read commands are allowed';
  if ((lower === 'composer' || lower === 'npm') && args.some((a) => /^--(registry|repository|repository-url)(=|$)/.test(a))) return `${first} with a custom registry or repository is not allowed`;
  if (lower === 'composer') {
    const sub = args[0] ?? '';
    if (/^(show|info)$/.test(sub)) {
      if (!args.some((a) => /^(--locked|-i|--installed)$/.test(a))) return 'composer show without --locked or --installed reaches the network';
      if (args.some((a) => /^(-l|--latest|-o|--outdated|-a|--available|--all)$/.test(a))) return 'composer show --latest, --outdated and --all reach the network';
      return null;
    }
    if (!/^(validate|licenses|depends|why|why-not|prohibits|check-platform-reqs|--version|-V)$/.test(sub)) return 'only local composer read commands are allowed (show --locked, validate, licenses, depends, why, why-not, check-platform-reqs)';
  }
  if (lower === 'npx') return 'npx is not allowed for judgment agents';
  if (lower === 'npm' && !/^(ls|list|--version|-v)$/.test(args[0] ?? '')) return 'only npm ls/list and npm --version are allowed for judgment agents (other npm subcommands reach the registry)';
  if (/^(node|php|python3?|ruby|perl)$/.test(lower)) {
    if (args.length === 1 && /^(--version|-v|-V)$/.test(args[0])) return null;
    const scriptIdx = args.findIndex((a) => !a.startsWith('-'));
    const before = scriptIdx >= 0 ? args.slice(0, scriptIdx) : args;
    const inline = before.find((a) => INTERPRETER_INLINE.test(a));
    if (inline) return `${first} ${inline}: inline code, preloads and runtime options are not allowed; put a probe into a script file in the environment the brief names`;
    const script = scriptIdx >= 0 ? args[scriptIdx] : undefined;
    if (!script || !SCRIPT_FILE.test(script)) return `${first} needs a script file argument`;
    const path = script.replace(/\\/g, '/');
    if (/(^|\/)\.\.(\/|$)/.test(path) || !TOOL_SCRIPT_PATH.test(path)) return `${first} may only run the skill scripts of the installed plugins (\${CLAUDE_PLUGIN_ROOT}/…, ~/.claude/plugins/…, plugins/<plugin>/skills/<skill>/<script>; no ..) (got ${script}); test runners and project code need a run grant`;
  }
  return null;
}

function judgmentPrecheck(segment, shell) {
  if (/\$\(|`|<\(|>\(/.test(segment)) return 'command and process substitution are not allowed';
  const bad = redirections(segment, shell).find((r) => !redirectAllowed(r, shell));
  if (bad) return `output redirection is not allowed (${bad.op}${bad.target ? ` ${bad.target}` : ''})`;
  return null;
}

export function segmentVerdict(segment, tier, shell = 'bash') {
  const toks = tokens(segment, shell);
  if (toks.length === 0) return null;
  const r = resolveCommand(toks, shell);
  if (r.error) return r.error;
  const cmd = r.toks;
  const cmdTok = cmd[0];
  const lower = cmdTok ? baseName(cmdTok.text, shell).toLowerCase() : '';
  // Orchestrator tools, any tier: only a viewer may name them.
  if (mentionsOrchestratorScript(toks) && (!VIEWERS.has(lower) || r.viaXargs)) return ORCHESTRATOR_REASON;
  // The plugin's own state (grants, session pointer, data-dir pointer, usage log), any tier: only a viewer may name
  // it. A worker can still write it through a script it wrote itself; this is a tripwire against the ordinary forms.
  if (mentionsPluginState(segment) && (!VIEWERS.has(lower) || r.viaXargs)) return PLUGIN_STATE_REASON;
  if (tier === 'judgment') {
    const pre = judgmentPrecheck(segment, shell);
    if (pre) return pre;
  } else if (/`|\$\(.*\b(git|gh|glab|curl)\b/.test(segment) && /\b(git|gh|glab|curl)\b/.test(segment)) {
    return 'git, gh, glab or curl behind command substitution is not allowed for workers';
  }
  // Variable indirection: a remote-effect program stored in a variable, or a variable as the command word.
  const declared = /^(export|declare|typeset|local|readonly|alias)$/.test(lower) ? cmd.slice(1).map((t) => t.text).filter((a) => ASSIGNMENT.test(a)) : [];
  if ([...r.assignments, ...declared].some(assignsRemoteProgram)) return 'assigning git, gh, glab or curl to a variable or alias is not allowed';
  if (tier === 'judgment' && r.assignments.length) return 'environment assignments before a command are not allowed';
  if (!cmdTok) return null;
  if (cmdTok.text.startsWith('$')) return 'a variable as command is not allowed';
  if (tier === 'judgment') {
    if (/^(eval|exec|source|\.)$/.test(lower)) return 'eval, exec and sourcing are not allowed';
    if (r.prefixes.some((p) => p === 'sudo' || p === 'doas')) return 'sudo and doas are not allowed';
    if (shell === 'powershell' && r.prefixes.some((p) => p === '&' || p === '.')) return 'the call operator is not allowed';
    if (/[\\"']/.test(cmdTok.raw) && shell !== 'powershell' || /^\.?\//.test(cmdTok.text) && !/^\/usr\/bin\/(git|grep|cat|ls)$/.test(cmdTok.text)) return 'quoted, escaped or path-form command names are not allowed';
  }
  if (r.viaXargs && (REMOTE_PROGRAMS.test(lower) || innerCommandOf(cmd, shell))) return `${lower} with arguments built by xargs cannot be checked`;
  if (lower === 'git') return gitVerdict(cmd, tier);
  const wrapper = innerCommandOf(cmd, shell);
  if (wrapper) {
    if (wrapper.kind === 'script') return tier === 'judgment' ? `running a shell script (${wrapper.script}) is not allowed` : null;
    if (wrapper.container && tier === 'judgment') return 'docker exec/run is not allowed for judgment agents';
    return verdict(wrapper.inner, tier, 'bash');
  }
  const args = cmd.slice(1).map((t) => t.text);
  const remote = remoteEffectVerdict(lower, args);
  if (remote) return remote;
  if (RUNNERS.has(lower)) {
    const runs = cmd.slice(1).find((t) => REMOTE_PROGRAMS.test(baseName(t.text, shell).toLowerCase()) || /(^|[\s;&|(])(git|gh|glab|curl)(\.exe)?(\s|$)/.test(t.text));
    if (runs) return `${lower} runs ${runs.text}; git, gh, glab and curl behind ${lower} are not allowed`;
  }
  if (tier === 'worker') {
    if (lower === 'find') {
      for (let k = 1; k < cmd.length; k++) {
        if (!/^-(exec|execdir|ok|okdir)$/.test(cmd[k].text)) continue;
        let e = k + 1;
        while (e < cmd.length && !(cmd[e].text === ';' || cmd[e].text === '+')) e++;
        const v = segmentVerdict(cmd.slice(k + 1, e).map((t) => t.raw).join(' '), tier, shell);
        if (v) return v;
        k = e;
      }
    }
    return null;
  }
  if (shell === 'powershell') {
    if (POWERSHELL_DENY.test(segment)) return 'this PowerShell command writes, deletes or executes';
    const expr = POWERSHELL_EXPRESSION.find(([re]) => re.test(segment));
    if (expr) return `PowerShell argument expressions are not allowed (${expr[1]})`;
    if (/\b(-command|-c)\b\s/i.test(segment) && /powershell|pwsh/i.test(cmdTok.text)) return 'nested PowerShell -Command is not allowed';
    if (!POWERSHELL_READ_ONLY.has(lower)) return `${cmdTok.text} is not in the read-only allowlist`;
  } else if (!READ_ONLY_PROGRAMS.has(lower)) {
    return `${cmdTok.text} is not in the read-only allowlist`;
  }
  return readOnlyOptionsVerdict(cmdTok.text, lower, args);
}

export function verdict(command, tier, shell = 'bash') {
  let segments;
  try {
    segments = splitSegments(command);
  } catch (e) {
    return `command could not be parsed (${e.message})`;
  }
  // An orchestrator script piped or fed into an interpreter: cat …/grant-run.mjs | node - grant …
  const parsed = segments.map((seg) => resolveCommand(tokens(seg, shell), shell));
  if (segments.some((seg) => mentionsOrchestratorScript(tokens(seg, shell))) && parsed.some((r) => r.viaXargs || STDIN_RUNNERS.has(baseName(r.toks[0]?.text ?? '', shell).toLowerCase()))) return ORCHESTRATOR_REASON;
  for (const seg of segments) {
    const v = segmentVerdict(seg, tier, shell);
    if (v) return v;
  }
  return null;
}

// Main session: issuing a run grant (grant-run.mjs grant, worktree-setup.mjs --grant) needs the human's confirmation.
export function issuesGrant(command) {
  const c = String(command ?? '').replace(/\\+/g, '/');
  const after = (re) => {
    const m = re.exec(c);
    return m ? c.slice(m.index + m[0].length) : null;
  };
  const run = after(/grant-run\.mjs/);
  if (run !== null && /(^|[\s"'])grant(?=[\s"']|$)/.test(run)) return true;
  const setup = after(/worktree-setup\.mjs/);
  return setup !== null && /(^|[\s"'])--grant(?=[=\s"']|$)/.test(setup);
}

const GRANT_ASK = 'A run grant moves a judgment agent to the worker tier (runs, writes, network) inside the named environment; the environment is a host worktree, not a sandbox. Confirm the grant.';

export function decide(input, env = process.env) {
  if (!SHELL_TOOLS.has(input.tool_name)) return null;
  const command = input.tool_input?.command ?? '';
  const name = agentName(input.agent_type);
  if (!name) {
    if (!issuesGrant(command)) return null;
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: GRANT_ASK } };
  }
  const isWorker = WRITING_WORKERS.has(name);
  const grant = isWorker ? null : activeGrant(name, env, Date.now(), input.session_id);
  const granted = Boolean(grant) && grantApplies(grant, input.cwd, input.session_id);
  const tier = isWorker || granted ? 'worker' : 'judgment';
  const shell = input.tool_name === 'PowerShell' ? 'powershell' : 'bash';
  const reason = verdict(command, tier, shell);
  if (!reason) return null;
  let head;
  if (isWorker) head = 'Implementation workers deliver a diff; they do not commit, push, fetch, rewrite history or publish (worker contract rule 8).';
  else if (granted) head = `Run grant active (project ${grant.project ?? 'unknown'}, environment ${grant.root}); the environment is the boundary, not this hook. Still denied: commit, push, fetch, history rewrites, publication and the orchestrator tools; delivery is the diff (worker contract rule 8).`;
  else if (grant) {
    const why = sessionMatches(grant, input.session_id) ? `the working directory ${input.cwd ?? '(none)'} is outside the environment` : 'it was issued in another session';
    head = `A run grant exists for ${name} (environment ${grant.root}) but does not apply here: ${why}; here this agent runs read-only commands only (worker contract rule 8).`;
  } else head = 'This agent runs read-only commands only; runs need a grant for a disposable environment from the orchestrator (worker contract rule 8).';
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `${head} Blocked: ${reason}. Command: ${String(command).slice(0, 120)}` } };
}

export function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, ''));
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
