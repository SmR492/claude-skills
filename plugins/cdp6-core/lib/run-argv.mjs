import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export class ArgvError extends Error {
  constructor(error, message) {
    super(message);
    this.error = error;
  }
}

function fail(error, message) {
  throw new ArgvError(error, message);
}

export const EXECUTOR = { single: 'operator', multi: 'orchestrator', team: 'team lead' };
export const APPENDED = ['--expect-sha256', '--session-id', '--data-dir', '--hook-token'];
export const FORBIDDEN_PREFIXES = ['--session-id', '--data-dir', '--hook-token', '--argv-sha256', '--expect-sha256'];
const TRIGGERS = ['run.mjs', '--argv-sha256', '--session-id', '--data-dir', '--hook-token'];
const COUNTED = ['--session-id', '--data-dir', '--hook-token'];
export const UNQUOTED = /^[A-Za-z0-9._:/@+=-]+$/;
export const CONTROL = /[\u0000-\u001f\u007f]/;
export const SESSION_ID = /^[A-Za-z0-9._:-]{1,128}$/;
export const SHELL_TOOLS = ['Bash', 'PowerShell', 'Monitor'];
const TYPOGRAPHIC = /[‘-‟]/;

export const COMMON_FLAGS = { values: COUNTED, bools: [], repeat: ['--expect-sha256'] };

export const FORMS = {
  init: {
    values: ['--intake', '--kind', '--origin', '--http-status', '--fetched', '--class', '--root', '--mode', '--assignment', '--start'],
    repeat: ['--import'],
    bools: [],
    positionals: 0,
  },
  status: { values: [], repeat: [], bools: [], positionals: 0 },
  enter: { values: [], repeat: [], bools: [], positionals: 1 },
  'set-autonomy': { values: ['--tokens', '--loops'], repeat: [], bools: [], positionals: 1 },
  object: { values: ['--why'], repeat: [], bools: [], positionals: 2 },
  id: { values: [], repeat: [], bools: [], positionals: 1 },
  decision: { values: ['--decider'], repeat: [], bools: [], positionals: 2 },
  exit: { values: [], repeat: [], bools: [], positionals: 1 },
  approve: { values: [], repeat: [], bools: [], positionals: 1 },
  rule: { values: ['--why'], repeat: [], bools: ['--human'], positionals: 1, unbuilt: true },
  veto: { values: ['--why'], repeat: [], bools: ['--lift'], positionals: 1, unbuilt: true },
};

export function tokenize(text) {
  if (CONTROL.test(text)) fail('token-rule', 'the call contains a control character');
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === ' ') {
      i += 1;
      continue;
    }
    let value;
    let quoted = false;
    if (text[i] === "'" || text[i] === '"') {
      const q = text[i];
      const end = text.indexOf(q, i + 1);
      if (end === -1) fail('token-rule', 'a quoted token is not closed');
      value = text.slice(i + 1, end);
      if (q === '"' && /[$`\\]/.test(value)) fail('token-rule', 'a double-quoted token holds $, a backtick or a backslash');
      if (TYPOGRAPHIC.test(value)) fail('token-rule', 'a quoted token holds a typographic quote character');
      quoted = true;
      i = end + 1;
      if (i < text.length && text[i] !== ' ') fail('token-rule', 'a token mixes quoted and unquoted parts');
    } else {
      let end = i;
      while (end < text.length && text[end] !== ' ') end += 1;
      value = text.slice(i, end);
      if (!UNQUOTED.test(value)) fail('token-rule', 'an unquoted token holds a character outside the allowed set');
      i = end;
    }
    tokens.push({ text: value, quoted });
  }
  return tokens;
}

export function callShape(command, pluginRoot) {
  if (!TRIGGERS.some((name) => command.includes(name))) return null;
  if (typeof pluginRoot !== 'string' || !pluginRoot.startsWith('/')) fail('call-shape', 'the plugin root is unknown');
  const tokens = tokenize(command);
  const script = `${pluginRoot.replace(/\/+$/, '')}/scripts/run.mjs`;
  const [node, path, sub, ...rest] = tokens;
  if (!node || node.quoted || node.text !== 'node') fail('call-shape', 'the call must start with node');
  if (!path || path.quoted || path.text !== script) fail('call-shape', 'the script path must follow node and be the absolute plugin script');
  if (!sub || sub.quoted) fail('call-shape', 'the subcommand must be an unquoted token');
  const table = [sub, ...rest];
  for (const t of table) {
    if (t.quoted && t.text.startsWith('--')) fail('token-rule', 'a quoted token must not look like a flag');
  }
  return { tokens: table };
}

export function parseCall(argv) {
  const [sub, ...rest] = argv;
  const form = Object.hasOwn(FORMS, sub) ? FORMS[sub] : null;
  if (!form) fail('unknown-subcommand', 'unknown subcommand');
  const values = new Map();
  const positionals = [];
  const allowedValue = new Set([...COMMON_FLAGS.values, ...COMMON_FLAGS.repeat, ...form.values, ...form.repeat]);
  const allowedBool = new Set(form.bools);
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    if (t.startsWith('--')) {
      if (t.includes('=')) fail('flag-form', 'the --flag=value form is not accepted');
      if (allowedBool.has(t)) {
        values.set(t, [...(values.get(t) ?? []), true]);
      } else if (allowedValue.has(t)) {
        if (i + 1 >= rest.length) fail('flag-value', `flag ${t} needs a value`);
        i += 1;
        values.set(t, [...(values.get(t) ?? []), rest[i]]);
      } else {
        fail('unknown-flag', 'unknown flag for this subcommand');
      }
    } else {
      positionals.push(t);
    }
  }
  if (positionals.length !== (form.positionals ?? 0)) fail('positionals', 'unexpected positional arguments');
  for (const [flag, list] of values) {
    const repeats = form.repeat.includes(flag) || COMMON_FLAGS.repeat.includes(flag) || COUNTED.includes(flag);
    if (list.length > 1 && !repeats) fail('duplicate-flag', `flag ${flag} occurs more than once`);
  }
  return { sub, values, positionals, unbuilt: form.unbuilt === true };
}

export function stripAppended(argv) {
  const bare = [];
  const expect = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (APPENDED.includes(argv[i])) {
      if (argv[i] === '--expect-sha256' && i + 1 < argv.length) expect.push(argv[i + 1]);
      i += 1;
    } else {
      bare.push(argv[i]);
    }
  }
  return { bare, expect };
}

export function ownerForm(call, mode) {
  const first = (flag) => call.values.get(flag)?.[0];
  switch (call.sub) {
    case 'approve':
    case 'set-autonomy':
    case 'object':
    case 'veto':
      return true;
    case 'rule':
      return call.values.has('--human');
    case 'init':
      return (first('--start') !== undefined && first('--start') !== 'idea') || first('--mode') === 'team';
    case 'decision': {
      if (call.positionals[1] !== 'decided') return false;
      const executor = Object.hasOwn(EXECUTOR, mode) ? EXECUTOR[mode] : undefined;
      if (executor === undefined) return true;
      const decider = first('--decider');
      return decider !== undefined && decider !== executor;
    }
    default:
      return false;
  }
}

export function describeCall(call) {
  const parts = [call.sub, ...call.positionals];
  for (const [flag, list] of call.values) {
    if (APPENDED.includes(flag)) continue;
    for (const v of list) parts.push(v === true ? flag : `${flag} ${UNQUOTED.test(v) ? v : JSON.stringify(v)}`);
  }
  return parts.join(' ');
}

export function readRunCall(command, env) {
  const root = env.CLAUDE_PLUGIN_ROOT ?? dirname(dirname(fileURLToPath(import.meta.url)));
  const shape = callShape(command, root);
  if (!shape) return null;
  const words = shape.tokens.map((t) => t.text);
  return { call: parseCall(words), words };
}
