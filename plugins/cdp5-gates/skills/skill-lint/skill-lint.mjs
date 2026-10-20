#!/usr/bin/env node
// CDP5 §32.9 T1 skill — skill-lint (read-only): checks skill and agent definitions of a plugin or marketplace against
// the Agent Skills specification (agentskills.io), the repository's own conventions, and supply-chain signals that
// a skill carries before it is installed (ToxicSkills classes: remote execution, credential reach, instruction
// override, encoded payloads, install-time scripts, unpinned sources).
// Exit: 0 = no 🔴 · 1 = ≥1 🔴 · 2 = usage error.
// Heuristic: a finding is a reason to read the file, an exit 0 is not a clearance.

import { readFileSync, readdirSync, lstatSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guardPaths } from '../../lib/args.mjs';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', '.tmp', 'entries']);
const TEST_PATH = /(\.test\.[cm]?js$|\/fixtures?\/|\/__tests__\/|\.spec\.[cm]?js$)/;
const CODE_EXT = new Set(['.mjs', '.cjs', '.js', '.ts', '.sh', '.bash', '.ps1', '.py', '.rb', '.pl', '.php']);
const TEXT_EXT = new Set(['.md', '.txt', '.json', '.yaml', '.yml']);
const BINARY_EXT = new Set(['.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.node', '.jar', '.pyc']);
const SPEC_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const CLAUDE_KEYS = new Set(['user-invocable', 'disable-model-invocation', 'argument-hint', 'model', 'context', 'agent', 'hooks', 'paths', 'effort', 'tools', 'skills', 'color', 'mcpServers', 'permissionMode', 'initialPrompt']);
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GERMAN = /\b(und|oder|nicht|wird|werden|muss|eine|einer|für|auch|dabei|sowie)\b/;
const MAX_SIZE = 1_000_000;

// Supply-chain patterns. `scope` says which files they apply to; `sev` the severity in non-test files.
const SIGNALS = [
  { id: 'X1', sev: '🔴', scope: 'code', why: 'remote or dynamic code execution', re: /(curl|wget|Invoke-WebRequest|iwr)\b[^\n|]*\|\s*(ba|z|da)?sh\b|(?<!['"`])\beval\s*\(|(?<![\w'"`])eval\s+["'$]|new\s+Function\s*\(|Invoke-Expression\s*\(|\biex\s*\(|base64\s+(-d|--decode)[^\n]*\|\s*(ba)?sh\b|\batob\s*\([^\n]*\)\s*\)\s*\(/i },
  { id: 'X2', sev: '🔴', scope: 'code', why: 'reaches credentials or secret stores', re: /~\/\.ssh|\bid_rsa\b|\.aws\/credentials|\.netrc\b|\/etc\/(passwd|shadow)|process\.env\.[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)\b|\$env:[A-Z0-9_]*(KEY|TOKEN|SECRET)\b|keychain|credential\s*manager/i },
  { id: 'X3', sev: '🔴', scope: 'text', why: 'instruction override or concealment aimed at the agent', re: /ignore (all |any )?(previous|prior|above|earlier) (instructions|rules)|disregard (your|the|all) (previous |prior )?(instructions|rules|guidelines)|do not (tell|inform|mention|reveal)[^\n]{0,40}\buser\b|without (telling|informing|asking) the user|hide [^\n]{0,30}from the user|you are now (in )?(developer|god|unrestricted) mode|override (your )?(safety|system) (rules|prompt)/i },
  { id: 'X4', sev: '🟡', scope: 'code', why: 'network access', re: /\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b|\bfetch\s*\(|https?:\/\/[a-z0-9.-]+/i },
  { id: 'X5', sev: '🟡', scope: 'all', why: 'encoded payload', re: /[A-Za-z0-9+/]{120,}={0,2}|(\\x[0-9a-f]{2}){24,}|Buffer\.from\([^\n]{1,80},\s*['"]base64['"]\)|\batob\s*\(/i },
  { id: 'X6', sev: '🟡', scope: 'code', why: 'unpinned package execution', re: /\bnpx\s+(-y\s+|--yes\s+)?(?!-)(@[a-z0-9-]+\/)?[a-z0-9-]+(?![@a-z0-9-])\b(?![^\n]*@\d)|\bpip\s+install\s+(?![^\n]*==)|\bgem\s+install\b/i },
];

function walk(root, out = []) {
  let entries;
  try { entries = readdirSync(root); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(root, name);
    let st;
    try { st = lstatSync(full); } catch { continue; }
    if (st.isSymbolicLink()) { out.push({ path: full, symlink: true }); continue; }
    if (st.isDirectory()) walk(full, out);
    else out.push({ path: full, size: st.size });
  }
  return out;
}

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { fm: null, body: text, keys: [] };
  const fm = {};
  const keys = [];
  let current = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (/^\s+/.test(raw) && current) { fm[current] = (fm[current] ? `${fm[current]}\n` : '') + raw.trim(); continue; }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(raw);
    if (!kv) continue;
    current = kv[1];
    keys.push(current);
    fm[current] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { fm, body: m[2], keys };
}

function stripFences(body) {
  return body.split(/```[\s\S]*?```/).join('\n');
}

export function lintSkill(skillDir, { kind = 'skill', conventions = true } = {}) {
  const file = kind === 'skill' ? join(skillDir, 'SKILL.md') : skillDir;
  const findings = [];
  const add = (sev, check, issue) => findings.push({ sev, check, issue });
  const text = readFileSync(file, 'utf8');
  const { fm, body, keys } = parseFrontmatter(text);
  if (!fm) { add('🔴', 'S1', 'no YAML frontmatter'); return { file, findings }; }
  const name = fm.name ?? '';
  if (!name) add('🔴', 'S2', 'name missing');
  else {
    if (name.length > 64 || !NAME_RE.test(name)) add('🔴', 'S2', `name "${name}" violates the spec (1–64 chars, lowercase letters, digits, single hyphens)`);
    const expected = kind === 'skill' ? basename(skillDir) : basename(file, '.md');
    if (name !== expected) add('🔴', 'S3', `name "${name}" does not match its ${kind === 'skill' ? 'directory' : 'file'} name "${expected}"`);
  }
  const desc = fm.description ?? '';
  if (!desc.trim()) add('🔴', 'S4', 'description missing');
  else {
    if (desc.length > 1024) add('🔴', 'S4', `description has ${desc.length} characters (max 1024)`);
    if (!/\b(use (it |this )?(when|for|on|before|after|in|to)|when (the )?user|trigger|read (it |this )?(when|before)|load(ed)? (when|for|by)|applies (when|to)|on ["„“])/i.test(desc)) add('🟡', 'S4', 'description does not say when to use the skill ("Use when …", "Use for …")');
  }
  if (fm.compatibility !== undefined && (fm.compatibility.length < 1 || fm.compatibility.length > 500)) add('🟡', 'S7', 'compatibility must be 1–500 characters');
  if (fm['allowed-tools'] !== undefined && /\n|,/.test(fm['allowed-tools'])) add('🟡', 'S7', 'allowed-tools is a space-separated string');
  for (const k of keys) if (!SPEC_KEYS.has(k) && !CLAUDE_KEYS.has(k)) add('🟢', 'S8', `frontmatter key "${k}" is neither in the Agent Skills spec nor a known Claude Code field`);
  const bodyLines = body.split(/\r?\n/).length;
  if (bodyLines > 500) add('🟡', 'S5', `body has ${bodyLines} lines (spec recommends under 500; move detail to references/)`);
  // S9: after a context compaction Claude Code re-injects a skill body up to 5,000 tokens and cuts the end.
  if (body.length > 20_000) add('🟡', 'S9', `body is about ${Math.round(body.length / 4)} tokens; the post-compaction re-injection keeps the first 5,000 tokens per skill, so the operative rules stand first or move to references/`);
  // S6: relative file references must exist and stay one level deep
  const prose = stripFences(body);
  const refs = new Set();
  // Markdown links outside inline code (a link inside backticks is an example, not a reference);
  // backtick paths with a directory part are references to the skill's own files.
  for (const m of prose.replace(/`[^`\n]*`/g, '').matchAll(/\]\(([^)#\s]+)\)/g)) refs.add(m[1]);
  for (const m of prose.matchAll(/`([A-Za-z0-9_./-]+\/[A-Za-z0-9_.-]+\.[a-z]{1,5})`/g)) refs.add(m[1]);
  const baseDir = kind === 'skill' ? skillDir : dirname(file);
  for (const ref of refs) {
    if (/^(https?:|mailto:|\$\{|\/|[A-Za-z]:\\)/.test(ref) || ref.includes('${')) continue;
    if (ref.startsWith('..')) continue; // cross-directory reference: not a skill file
    const clean = ref.replace(/^\.\//, '');
    const firstDir = clean.includes('/') ? clean.split('/')[0] : null;
    // Only references into the skill's own subdirectories are checked; a path whose first segment is not a
    // directory of this skill points elsewhere (another plugin, an example path) and is out of scope.
    if (firstDir && !existsSync(join(baseDir, firstDir))) continue;
    const target = join(baseDir, clean);
    if (!existsSync(target)) add('🟡', 'S6', `referenced file "${ref}" does not exist in the skill directory`);
    else if (clean.split('/').length > 2) add('🟢', 'S6', `reference "${ref}" is nested more than one level deep`);
  }
  if (conventions) {
    if (/think (hard|harder|deeply)|ultrathink/i.test(body)) add('🟡', 'C1', 'thinking phrase in the body; thinking depth belongs in the effort field');
    const emphatic = (body.match(/\b(MUST|NEVER|ALWAYS|CRITICAL|IMPORTANT)\b/g) ?? []).length;
    if (emphatic >= 3) add('🟡', 'C2', `${emphatic} emphatic markers (MUST/NEVER/ALWAYS/CRITICAL/IMPORTANT); current models over-trigger on them, plain wording suffices`);
    // Quoted spans („…“, “…”, "…") are source material (doctrine quotes, verdict vocabulary), not the skill's own prose.
    const unquoted = (l) => l.replace(/„[^“”"]*[“”"]|“[^”]*”|"[^"\n]*"/g, '');
    const germanLines = prose.split(/\r?\n/).filter((l) => !/^\s*[|>]/.test(l) && GERMAN.test(unquoted(l))).length;
    if (germanLines >= 3) add('🟡', 'C3', `${germanLines} prose lines look German; the repository language is English (quotes and verdict vocabulary excepted)`);
    if (kind === 'agent') {
      if (fm.model && !/^(opus|sonnet|haiku|inherit)$/.test(fm.model)) add('🟡', 'C4', `model "${fm.model}" is not one of opus, sonnet, haiku, inherit`);
      if (fm.effort && !/^(low|medium|high|xhigh|max)$/.test(fm.effort)) add('🟡', 'C4', `effort "${fm.effort}" is not one of low, medium, high, xhigh, max`);
    }
  }
  return { file, name, findings };
}

export function scanTree(root) {
  const findings = [];
  const add = (sev, check, file, issue) => findings.push({ sev, check, file: (relative(root, file) || basename(file)).replace(/\\/g, '/'), issue });
  const files = walk(root);
  for (const f of files) {
    if (f.symlink) { add('🟡', 'X9', f.path, 'symbolic link inside the skill tree'); continue; }
    const ext = extname(f.path).toLowerCase();
    const rel = relative(root, f.path).replace(/\\/g, '/');
    if (BINARY_EXT.has(ext)) { add('🟡', 'X9', f.path, 'binary file shipped with the skill'); continue; }
    if (f.size > MAX_SIZE) { add('🟡', 'X9', f.path, `file larger than 1 MB (${f.size} bytes), not scanned`); continue; }
    const isCode = CODE_EXT.has(ext) || basename(f.path) === 'hooks.json';
    const isText = TEXT_EXT.has(ext);
    if (!isCode && !isText) continue;
    let text;
    try { text = readFileSync(f.path, 'utf8'); } catch { continue; }
    const isTest = TEST_PATH.test(`/${rel}`);
    const lines = text.split('\n');
    for (const s of SIGNALS) {
      if (s.scope === 'code' && !isCode) continue;
      if (s.scope === 'text' && !(isText || ext === '.md')) continue;
      const re = new RegExp(s.re.source, s.re.flags.includes('g') ? s.re.flags : `${s.re.flags}g`);
      let m;
      // Per signal and file: the first downgraded (🟢) hit is reported once, but scanning continues until a hit
      // that is NOT downgraded — a comment mentioning `eval(` must not shadow a real `eval(payload)` further down.
      let infoReported = false;
      while ((m = re.exec(text))) {
        if (m[0] === '') { re.lastIndex++; continue; }
        const lineNo = text.slice(0, m.index).split('\n').length;
        const lineText = lines[lineNo - 1] ?? '';
        const inComment = isCode && /^\s*(\/\/|#|\*|\/\*)/.test(lineText);
        const inPattern = isCode && /(\bre:\s*\/|new RegExp\(|=\s*\/[^/]|\.test\(|\.exec\(|\.match\()/.test(lineText);
        let sev = s.sev;
        let note = '';
        if (isTest) { sev = '🟢'; note = ' (test or fixture file, informational)'; }
        else if (inPattern) { sev = '🟢'; note = ' (inside a pattern definition, informational)'; }
        else if (inComment) { sev = '🟢'; note = ' (in a comment, informational)'; }
        const downgraded = sev !== s.sev;
        if (downgraded && infoReported) continue;
        add(sev, s.id, f.path, `${s.why}${note}: line ${lineNo}: ${m[0].slice(0, 80).replace(/\s+/g, ' ')}`);
        if (!downgraded) break;
        infoReported = true;
        if (isTest) break;   // every hit in a test file is informational — one is enough
      }
    }
    if (basename(f.path) === 'package.json') {
      try {
        const pkg = JSON.parse(text);
        for (const k of ['preinstall', 'install', 'postinstall', 'prepare']) if (pkg.scripts?.[k]) add('🟡', 'X6', f.path, `install-time script "${k}": ${pkg.scripts[k]}`);
      } catch { add('🟡', 'X6', f.path, 'package.json is not valid JSON'); }
    }
    if (basename(f.path) === 'hooks.json') {
      try {
        const hooks = JSON.parse(text).hooks ?? {};
        for (const [event, groups] of Object.entries(hooks)) {
          for (const g of groups ?? []) {
            const broad = g.matcher === undefined || g.matcher === '' || g.matcher === '.*' || g.matcher === '*';
            for (const h of g.hooks ?? []) {
              const cmd = h.command ?? '';
              if (/\b(curl|wget|Invoke-WebRequest|iwr)\b/.test(cmd)) add('🔴', 'X7', f.path, `${event} hook command downloads or sends over the network: ${cmd.slice(0, 80)}`);
              if (cmd && !/\$\{CLAUDE_PLUGIN_ROOT\}/.test(cmd) && !/^\s*(node|python3?|bash|sh)\s+["']?\$\{/.test(cmd)) add('🟡', 'X7', f.path, `${event} hook runs a command outside the plugin root: ${cmd.slice(0, 80)}`);
              if (broad && /PreToolUse|PostToolUse/.test(event)) add('🟢', 'X7', f.path, `${event} hook matches every tool (matcher "${g.matcher ?? ''}")`);
            }
          }
        }
      } catch { add('🟡', 'X7', f.path, 'hooks.json is not valid JSON'); }
    }
    if (basename(f.path) === 'marketplace.json') {
      try {
        for (const p of JSON.parse(text).plugins ?? []) {
          const src = typeof p.source === 'string' ? p.source : JSON.stringify(p.source ?? '');
          if (/^\.{0,2}\//.test(src)) continue;
          if (/github|https?:|git/i.test(src) && !/(sha|ref|commit|tag)["']?\s*:/.test(src) && !/@[0-9a-f]{7,40}\b|#[0-9a-f]{7,40}\b|@v?\d+\.\d+/.test(src)) add('🟡', 'X8', f.path, `plugin "${p.name}" source is not pinned to a commit or tag: ${src.slice(0, 80)}`);
        }
      } catch { add('🟡', 'X8', f.path, 'marketplace.json is not valid JSON'); }
    }
  }
  return findings;
}

export function discover(root) {
  const abs = resolve(root);
  if (existsSync(join(abs, 'SKILL.md'))) return { skills: [abs], agents: [] };
  const skills = [];
  const agents = [];
  for (const f of walk(abs)) {
    if (f.symlink) continue;
    if (basename(f.path) === 'SKILL.md') skills.push(dirname(f.path));
    else if (/[\\/]agents[\\/][^\\/]+\.md$/.test(f.path)) agents.push(f.path);
  }
  return { skills: skills.sort(), agents: agents.sort() };
}

export function run(root, { scan = true, conventions = true } = {}) {
  const abs = resolve(root);
  const { skills, agents } = discover(abs);
  const results = [
    ...skills.map((d) => ({ kind: 'skill', ...lintSkill(d, { kind: 'skill', conventions }) })),
    ...agents.map((f) => ({ kind: 'agent', ...lintSkill(f, { kind: 'agent', conventions }) })),
  ].map((r) => ({ ...r, file: (relative(abs, r.file) || basename(r.file)).replace(/\\/g, '/') }));
  const supply = scan ? scanTree(abs) : [];
  const all = [...results.flatMap((r) => r.findings), ...supply];
  return {
    root: abs,
    skills: skills.length,
    agents: agents.length,
    definitions: results,
    supply,
    counts: { critical: all.filter((f) => f.sev === '🔴').length, warning: all.filter((f) => f.sev === '🟡').length, info: all.filter((f) => f.sev === '🟢').length },
    hasCritical: all.some((f) => f.sev === '🔴'),
  };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, v] = x.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!a.path) { console.error('Usage: skill-lint.mjs --path=<skill dir | plugin dir | marketplace root> [--no-scan] [--spec-only] [--json]'); process.exit(2); }
  guardPaths([[a.path, 'dir']]);
  const r = run(a.path, { scan: !a['no-scan'], conventions: !a['spec-only'] });
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.hasCritical ? 1 : 0); }
  console.log(`skill-lint — ${r.skills} skills, ${r.agents} agents, ${r.counts.critical} 🔴 ${r.counts.warning} 🟡 ${r.counts.info} 🟢\n`);
  for (const d of r.definitions) {
    console.log(`  ${d.kind} ${d.file}${d.name ? ` (${d.name})` : ''}: ${d.findings.length ? '' : 'ok'}`);
    for (const f of d.findings) console.log(`    ${f.sev} ${f.check} ${f.issue}`);
  }
  if (r.supply.length) {
    console.log('\n  supply chain:');
    for (const f of r.supply) console.log(`    ${f.sev} ${f.check} ${f.file}: ${f.issue}`);
  } else if (!a['no-scan']) console.log('\n  supply chain: no signals.');
  console.log('\n  A finding is a reason to read the file; exit 0 is not a clearance.');
  process.exit(r.hasCritical ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
