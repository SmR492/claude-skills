const FLAGS = {
  ls: 'lahR1tr',
  cat: 'n',
  wc: 'lwcm',
  grep: 'niclvFEwxrH',
  sha256sum: '',
};
const COUNTED = new Set(['head', 'tail']);
const DATE_ARGUMENT = /^(-u|-R|-Is|-Iseconds|\+.*)$/;
const OUTSIDE_FORBIDDEN = new Set(['$', '`', '\\', '{', '}', '*', '?', '[', ']', '<', '>', '(', ')', '#']);
const PLAIN = /^[\x20-\x7e\t\n]*$/;
const INSIDE_FORBIDDEN = new Set(['$', '`', '\\']);

function lex(command) {
  const out = [];
  let tokens = [];
  let token = null;
  let quote = null;
  const endToken = () => {
    if (token !== null) tokens.push(token);
    token = null;
  };
  const endSegment = () => {
    endToken();
    if (tokens.length === 0) return false;
    out.push(tokens);
    tokens = [];
    return true;
  };
  for (let i = 0; i < command.length; i += 1) {
    const c = command[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else token += c;
    } else if (quote === '"') {
      if (INSIDE_FORBIDDEN.has(c)) return null;
      if (c === '"') quote = null;
      else token += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      token ??= '';
    } else if (OUTSIDE_FORBIDDEN.has(c)) {
      return null;
    } else if (c === ' ' || c === '\t') {
      endToken();
    } else if (c === '|' || c === '&' || c === ';' || c === '\n') {
      if (c === '&' && command[i + 1] !== '&') return null;
      if ((c === '|' || c === '&') && command[i + 1] === c) i += 1;
      if (!endSegment()) return null;
    } else {
      token = (token ?? '') + c;
    }
  }
  if (quote !== null) return null;
  return endSegment() ? out : null;
}

function namedFlag(token, allowed) {
  return /^-.+$/.test(token) && token.length > 1 && [...token.slice(1)].every((ch) => allowed.includes(ch));
}

function operandsAllowed(tokens, allowed) {
  for (const t of tokens) {
    if (t.startsWith('-')) {
      if (!namedFlag(t, allowed)) return false;
    }
  }
  return true;
}

function countedAllowed(tokens) {
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t === '-n') {
      i += 1;
      if (!/^[0-9]+$/.test(tokens[i] ?? '')) return false;
    } else if (t.startsWith('-')) {
      return false;
    }
  }
  return true;
}

function segmentAllowed(tokens) {
  const [first, ...rest] = tokens;
  if (first === 'date') return rest.length === 0 || (rest.length === 1 && DATE_ARGUMENT.test(rest[0]));
  if (first === 'pwd') return rest.length === 0;
  if (COUNTED.has(first)) return countedAllowed(rest);
  return Object.hasOwn(FLAGS, first) && operandsAllowed(rest, FLAGS[first]);
}

export function readOnlyCall(command) {
  if (typeof command !== 'string') return false;
  if (!PLAIN.test(command)) return false;
  const parsed = lex(command);
  return parsed !== null && parsed.every(segmentAllowed);
}
