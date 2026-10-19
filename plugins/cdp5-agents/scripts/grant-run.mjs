#!/usr/bin/env node
// Registers, lists or revokes a run grant for a judgment agent (adversarial-auditor, review-verify, ...).
//   node grant-run.mjs grant --agent adversarial-auditor --root ../wt-audit [--ttl 2h] [--note "slice 7 counter-test"]
//   node grant-run.mjs list
//   node grant-run.mjs revoke --agent adversarial-auditor
// The orchestrate skill calls this before it spawns an agent that must run tests or probes in a disposable environment.
import { pathToFileURL } from 'node:url';
import { addGrant, consumeGrant, readGrants, pruneExpired, parseTtl, grantsPath, DEFAULT_TTL_MS } from '../lib/grants.mjs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

export function main(argv = process.argv.slice(2), env = process.env, out = (s) => process.stdout.write(s + '\n'), err = (s) => process.stderr.write(s + '\n')) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  try {
    if (cmd === 'grant') {
      const ttlMs = args.ttl ? parseTtl(args.ttl) : DEFAULT_TTL_MS;
      const g = addGrant({ agent: args.agent, root: args.root, ttlMs, note: typeof args.note === 'string' ? args.note : '' }, env);
      out(`grant: ${g.agent} may run in ${g.root} until ${g.expires} (${grantsPath(env)})`);
      return 0;
    }
    if (cmd === 'list') {
      const grants = pruneExpired(readGrants(env));
      if (grants.length === 0) out('grant: none active');
      for (const g of grants) out(`grant: ${g.agent} → ${g.root} until ${g.expires}${g.note ? ` (${g.note})` : ''}`);
      return 0;
    }
    if (cmd === 'revoke') {
      const used = consumeGrant(args.agent, env);
      out(used ? `grant: revoked ${used.agent} → ${used.root}` : `grant: nothing to revoke for ${args.agent ?? '(no agent)'}`);
      return 0;
    }
    err('usage: grant-run.mjs grant --agent <name> --root <path> [--ttl 2h] [--note text] | list | revoke --agent <name>');
    return 1;
  } catch (e) {
    err(`grant: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
