#!/usr/bin/env node
// Converts raw Orbit doctrine exports (one JSON per entry) into knowledge-pack Markdown files for a skill.
// Deterministic: same input, same output. Only node: builtins.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function stripMarkers(text) {
  return String(text ?? '').split('\n').filter((l) => !l.startsWith('<<<nsai:')).join('\n').trim();
}

export function parseEntry(raw) {
  const outer = JSON.parse(raw);
  const inner = JSON.parse(stripMarkers(outer.text));
  const body = inner.body ?? {};
  const quelle = String(outer.herkunft?.quelle ?? '');
  const sourceMatch = quelle.match(/Quelle\s+([^,]+)/);
  const source = body.quelle ?? (sourceMatch ? sourceMatch[1].trim() : null);
  const migrated = quelle.match(/abgerufen\s+(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  return {
    ref: inner.ref,
    title: inner.title ?? inner.ref,
    category: inner.category ?? '',
    summary: typeof body === 'string' ? body : body.summary ?? '',
    points: Array.isArray(body.points) ? body.points : Array.isArray(body) ? body : [],
    source: source && source !== '?' ? source : 'none recorded (internal doctrine entry)',
    migrated,
    version: inner.version ?? outer.fassung ?? null,
    orbitId: outer.id ?? '',
  };
}

export function redact(text, names) {
  let out = String(text);
  for (const n of names) if (n) out = out.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[Person]');
  return out;
}

export function applyOverrides(text, rules = []) {
  let out = String(text);
  for (const [pattern, replacement] of rules) out = out.replace(new RegExp(pattern, 'g'), replacement);
  return out;
}

export function render(e, names = [], overrides = {}) {
  const rules = overrides[e.ref] ?? [];
  const r = (t) => applyOverrides(redact(t, names), rules);
  const lines = [
    `# ${r(e.title)}`,
    '',
    `Ref: \`${e.ref}\` · Category: ${e.category || 'n/a'} · Entry version: ${e.version ?? 'n/a'}`,
    `Source: ${r(e.source)}. Provenance: bulk extraction 2026-07-02, migrated to Orbit ${e.migrated ?? 'on an unknown date'} (${e.orbitId}); content unverified against a primary source. Treat figures and legal statements as unverified until checked.`,
    '',
  ];
  if (e.summary) lines.push(r(e.summary), '');
  if (e.points.length) {
    for (const p of e.points) lines.push(`- ${r(p)}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function slugFor(ref) {
  return String(ref).replace(/^[A-Z]+:/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

// Pack manifest: one JSON per pack with what a reader needs before trusting an entry. Derived from the entries only
// (no timestamp of the build), so the same input gives the same manifest.
export function manifestFor({ prefix, title, entries, redacted, overrideRefs }) {
  const migrated = [...new Set(entries.map((e) => e.migrated).filter(Boolean))].sort();
  return {
    pack: title ?? `${prefix} knowledge pack`,
    prefix,
    entries: entries.length,
    refs: entries.map((e) => e.ref),
    source: 'Orbit doctrine export (riedl/nsai/doktrin), bulk extraction on 2026-07-02; each entry names its own source (a page of a source book, or none for an internal doctrine entry)',
    migrated_to_orbit: migrated,
    review_status: 'unverified: content not checked against a primary source; figures and legal statements are starting points',
    redaction: redacted ? 'personal names replaced by [Person]' : 'none',
    overrides: overrideRefs,
    license: 'summaries of the source books named per entry; the books themselves are not shipped',
    generator: 'scripts/build-packs.mjs',
  };
}

// Reads an existing pack directory back into the entry shape manifestFor needs (ref, migrated), so the manifest can
// be rebuilt without the raw export.
export function entriesFromPack(dir) {
  const entries = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md') && x !== 'INDEX.md').sort()) {
    const text = readFileSync(join(dir, f), 'utf8');
    const ref = text.match(/^Ref: `([^`]+)`/m)?.[1];
    if (!ref) continue;
    entries.push({ ref, migrated: text.match(/migrated to Orbit (\d{4}-\d{2}-\d{2})/)?.[1] ?? null });
  }
  return entries;
}

export function buildPack({ source, prefix, out, refs = null, names = [], overrides = {}, title = null }) {
  const files = readdirSync(source).filter((f) => f.startsWith(`${prefix}-`) && f.endsWith('.json')).sort();
  const wanted = refs ? new Set(refs) : null;
  const entries = [];
  const missing = new Set(wanted ?? []);
  for (const f of files) {
    let e;
    try { e = parseEntry(readFileSync(join(source, f), 'utf8')); } catch (err) { throw new Error(`${f}: ${err.message}`); }
    if (wanted && !wanted.has(e.ref)) continue;
    missing.delete(e.ref);
    entries.push(e);
  }
  if (existsSync(out)) rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const index = [`# ${title ?? `${prefix} knowledge pack`}`, '', `${entries.length} entries, generated by scripts/build-packs.mjs from the Orbit export; do not edit by hand.`, '', '| ref | title | category | file |', '|---|---|---|---|'];
  for (const e of entries) {
    const file = `${slugFor(e.ref)}.md`;
    writeFileSync(join(out, file), render(e, names, overrides));
    index.push(`| \`${e.ref}\` | ${redact(e.title, names)} | ${e.category} | [${file}](${file}) |`);
  }
  writeFileSync(join(out, 'INDEX.md'), index.join('\n') + '\n');
  const manifest = manifestFor({ prefix, title, entries, redacted: names.length > 0, overrideRefs: Object.keys(overrides).filter((r) => entries.some((e) => e.ref === r)).sort() });
  writeFileSync(join(out, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { count: entries.length, missing: [...missing] };
}

// Rebuilds MANIFEST.json of an existing pack from its entries (for packs whose raw export is not at hand).
export function writeManifest({ dir, prefix, title = null, redacted = false, overrides = {} }) {
  const entries = entriesFromPack(dir);
  const manifest = manifestFor({ prefix, title, entries, redacted, overrideRefs: Object.keys(overrides).filter((r) => entries.some((e) => e.ref === r)).sort() });
  writeFileSync(join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export function main(argv = process.argv.slice(2)) {
  const a = Object.fromEntries(argv.map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.join('=')]; }));
  if (a.manifest) {
    if (!a.prefix) { console.error('Usage: build-packs.mjs --manifest=<entries dir> --prefix=BL [--title=<pack title>] [--redacted] [--overrides=<json>]'); return 2; }
    try {
      const overrides = a.overrides ? JSON.parse(readFileSync(a.overrides, 'utf8')) : {};
      const m = writeManifest({ dir: a.manifest, prefix: a.prefix, title: a.title || null, redacted: 'redacted' in a, overrides });
      console.log(`${a.prefix}: MANIFEST.json written for ${m.entries} entries in ${a.manifest}`);
      return 0;
    } catch (e) {
      console.error(e.message);
      return 2;
    }
  }
  if (!a.source || !a.prefix || !a.out) { console.error('Usage: build-packs.mjs --source=<raw dir> --prefix=BL --out=<dir> [--refs=BL:a,BL:b] [--redact=name1,name2] [--overrides=<json>] [--title=<INDEX heading>]  |  --manifest=<entries dir> --prefix=BL [--title=…] [--redacted] [--overrides=<json>]'); return 2; }
  const refs = a.refs ? a.refs.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const names = a.redact ? a.redact.split(',').map((s) => s.trim()).filter(Boolean) : [];
  try {
    const overrides = a.overrides ? JSON.parse(readFileSync(a.overrides, 'utf8')) : {};
    const r = buildPack({ source: a.source, prefix: a.prefix, out: a.out, refs, names, overrides, title: a.title || null });
    console.log(`${a.prefix}: ${r.count} entries written to ${a.out}${r.missing.length ? `; missing: ${r.missing.join(', ')}` : ''}`);
    return r.missing.length ? 1 : 0;
  } catch (e) {
    console.error(e.message);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
