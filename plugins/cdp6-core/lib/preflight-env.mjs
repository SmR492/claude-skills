import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { environmentOf } from './preflight-proc.mjs';

const CREDENTIAL_NAME = /TOKEN|SECRET|PASSWORD|PASSWD|KEY|CREDENTIAL|AUTH/i;
const SCRUB = 'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB';

export function environment(x, fail, info) {
  const sources = [
    { item: `orchestrator pid ${x.proc.orchestratorPid}`, vars: environmentOf(x.proc.root, x.proc.orchestratorPid) },
    { item: 'own', vars: x.env },
  ];
  for (const { item, vars } of sources) {
    if (vars === null) {
      fail('environment', item, `the environment of ${item} is not readable`, 'run the preflight as the user of the orchestrator, from a shell that sees /proc');
      continue;
    }
    if (vars[SCRUB] === '1') {
      info.push(`${SCRUB}=1 in the environment of ${item}: credential names are not checked; Q-24 is open, since on Linux it also runs every command sandboxed and refuses the excluded run.mjs`);
      continue;
    }
    for (const name of Object.keys(vars).filter((n) => CREDENTIAL_NAME.test(n)).sort()) {
      fail('environment', `${item} ${name}`, `variable ${name} in the environment of ${item}`, `unset ${name} before the live session starts (value not printed)`);
    }
  }
}

const ALLOWED_KEYS = ['$schema', 'permissions'];
const ALLOWED_PERMISSIONS = ['ask', 'deny'];

function widening(doc) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return [['settings', 'is not a JSON object']];
  const out = [];
  for (const key of Object.keys(doc)) if (!ALLOWED_KEYS.includes(key)) out.push([key, `holds ${key}, which the allowlist of check (i) does not name`]);
  const permissions = doc.permissions;
  if (permissions === undefined) return out;
  if (permissions === null || typeof permissions !== 'object' || Array.isArray(permissions)) return [...out, ['permissions', 'holds permissions that is not an object']];
  for (const key of Object.keys(permissions)) if (!ALLOWED_PERMISSIONS.includes(key)) out.push([`permissions.${key}`, `holds permissions.${key}, which the allowlist of check (i) does not name`]);
  if (permissions.ask !== undefined && !Array.isArray(permissions.ask)) out.push(['permissions.ask', 'holds permissions.ask that is not a list']);
  if (permissions.deny !== undefined && !Array.isArray(permissions.deny)) out.push(['permissions.deny', 'holds permissions.deny that is not a list']);
  for (const list of ALLOWED_PERMISSIONS) {
    for (const rule of Array.isArray(permissions[list]) ? permissions[list] : []) {
      if (typeof rule !== 'string' || rule.includes('(')) out.push([`permissions.${list}`, `holds the ${list} rule ${JSON.stringify(rule)} with a specifier, which builds the sandbox configuration (Q-29)`]);
    }
  }
  return out;
}

export function projectSettings(x, fail) {
  const root = x.args.project;
  for (const file of ['.claude/settings.json', '.claude/settings.local.json']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    let doc;
    try {
      doc = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      fail('project-settings', file, `${path} is not readable as JSON`, `remove ${file} or repair it`);
      continue;
    }
    for (const [key, found] of widening(doc)) fail('project-settings', `${file} ${key}`, `${path} ${found}`, `remove ${key} from ${file}`);
  }
  if (existsSync(join(root, '.mcp.json'))) fail('project-settings', '.mcp.json', `${join(root, '.mcp.json')} exists`, 'remove .mcp.json from the project');
}

const FORCE_ENABLED = /^cdp6-core(@|$)/;

export function hooksOff(x, fail) {
  if (x.user?.disableAllHooks === true) fail('hooks-off', '~/.claude/settings.json disableAllHooks', '~/.claude/settings.json sets disableAllHooks true, which turns every cdp6 hook off', 'remove disableAllHooks from ~/.claude/settings.json');
  for (const m of x.managed) {
    if (m.doc?.disableAllHooks === true) fail('hooks-off', `${m.name} disableAllHooks`, `${m.path} sets disableAllHooks true, which disables every configured hook, managed ones included`, `remove disableAllHooks from ${m.path} as the administrator`);
    if (m.doc?.allowManagedHooksOnly === true) {
      const forced = Object.entries(m.doc.enabledPlugins ?? {}).some(([name, on]) => on === true && FORCE_ENABLED.test(name));
      fail('hooks-off', `${m.name} allowManagedHooksOnly`, `${m.path} sets allowManagedHooksOnly true and ${forced ? 'force-enables cdp6-core, which no probe shows to reach a plugin loaded through --plugin-dir' : 'does not force-enable cdp6-core, so its hooks do not run'}`, `remove allowManagedHooksOnly from ${m.path} as the administrator`);
    }
  }
  if (x.live.doc && x.live.doc.disableAllHooks !== false) fail('hooks-off', 'live settings disableAllHooks', `${x.args.settings} sets disableAllHooks to ${JSON.stringify(x.live.doc.disableAllHooks) ?? 'nothing'}, and it stands above project and local settings`, 'set disableAllHooks false in the --settings file');
}
