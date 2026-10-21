#!/usr/bin/env node
// Registers, lists or revokes a run grant for a judgment agent (adversarial-auditor, review-verify, ...).
//   node grant-run.mjs grant --agent adversarial-auditor --root ../wt-audit [--project <repo>] [--ttl 2h] [--uses 1] [--session <id>] [--note "slice 7 counter-test"]
//   node grant-run.mjs list
//   node grant-run.mjs revoke --agent adversarial-auditor [--session <id>]
// The orchestrate skill calls this from the main session before it spawns an agent that must run tests or probes in a
// disposable environment; the PreToolUse guard asks the human to confirm every grant, and denies this script to subagents.
// The root must be a linked git worktree of the project (never the project, the home directory or /). A grant applies
// only to agent runs whose working directory lies inside the root, and only in the session it was issued in
// (--session, default: the id the SessionStart hook wrote to ~/.cache/cdp5-agents/session).
import { pathToFileURL } from 'node:url';
import { addGrant, removeGrant, readGrants, pruneExpired, parseTtl, parseUses, grantsPath, DEFAULT_TTL_MS } from '../lib/grants.mjs';
import { readSessionPointer } from '../lib/data-dir.mjs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const k = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      if (eq >= 0) out[k] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

function describe(g) {
  const uses = g.uses ?? 1;
  return `${g.agent} → ${g.root} until ${g.expires} (${uses} use${uses === 1 ? '' : 's'} left, project ${g.project ?? 'unknown'}${g.session ? `, session ${g.session}` : ''})${g.note ? ` (${g.note})` : ''}`;
}

export function main(argv = process.argv.slice(2), env = process.env, out = (s) => process.stdout.write(s + '\n'), err = (s) => process.stderr.write(s + '\n')) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  try {
    if (cmd === 'grant') {
      const ttlMs = args.ttl ? parseTtl(args.ttl) : DEFAULT_TTL_MS;
      const uses = args.uses ? parseUses(args.uses) : 1;
      const project = typeof args.project === 'string' ? args.project : process.cwd();
      const session = typeof args.session === 'string' ? args.session : readSessionPointer(env);
      const g = addGrant({ agent: args.agent, root: args.root, project, ttlMs, uses, session, note: typeof args.note === 'string' ? args.note : '' }, env);
      out(`grant: ${g.agent} may run in ${g.root} until ${g.expires} for project ${g.project}, ${g.uses} use${g.uses === 1 ? '' : 's'}, session ${g.session} (${grantsPath(env)})`);
      return 0;
    }
    if (cmd === 'list') {
      const grants = pruneExpired(readGrants(env));
      if (grants.length === 0) out('grant: none active');
      for (const g of grants) out(`grant: ${describe(g)}`);
      return 0;
    }
    if (cmd === 'revoke') {
      const used = removeGrant(args.agent, env, Date.now(), typeof args.session === 'string' ? args.session : undefined);
      out(used ? `grant: revoked ${used.agent} → ${used.root}` : `grant: nothing to revoke for ${args.agent ?? '(no agent)'}`);
      return 0;
    }
    err('usage: grant-run.mjs grant --agent <name> --root <worktree> [--project <repo>] [--ttl 2h] [--uses 1] [--session <id>] [--note text] | list | revoke --agent <name> [--session <id>]');
    return 1;
  } catch (e) {
    err(`grant: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
