import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { within } from './paths.mjs';
import { credentialCovers, missingRules, sandboxCovers } from './user-settings.mjs';

const BROAD_DOMAINS = ['*', 'github.com', '*.github.com', 'githubusercontent.com', '*.githubusercontent.com', 'raw.githubusercontent.com'];
const WEB_FETCH_DOMAIN = /^WebFetch\(domain:(.*)\)$/;

export function settingsFile(x, fail, info) {
  const { settings, settingsSha256, dataDir, pluginDir } = x.args;
  const doc = x.live.doc;
  if (!doc) {
    fail('settings-file', 'sha256', `the --settings file ${settings} is ${x.live.error}`, 'pass the --settings file of the live session');
    return;
  }
  const actual = createHash('sha256').update(x.live.bytes).digest('hex');
  if (actual !== settingsSha256) fail('settings-file', 'sha256', `file ${actual}, --settings-sha256 ${settingsSha256}`, 'compare with the value in the ledger; if the file was changed on purpose, record the new hash');
  const sandbox = doc.sandbox ?? {};
  const permissions = doc.permissions ?? {};
  const show = (v) => (v === undefined ? 'not set' : JSON.stringify(v));
  const need = (item, ok, expected, shown = 'no entry covers it') => {
    if (!ok) fail('settings-file', item, `${shown} in ${settings}`, `set ${item} to ${expected}`);
  };
  need('sandbox.enabled', sandbox.enabled === true, 'true', show(sandbox.enabled));
  need('sandbox.failIfUnavailable', sandbox.failIfUnavailable === true, 'true', show(sandbox.failIfUnavailable));
  need('sandbox.allowUnsandboxedCommands', sandbox.allowUnsandboxedCommands === false, 'false', show(sandbox.allowUnsandboxedCommands));
  need('sandbox.network.strictAllowlist', sandbox.network?.strictAllowlist === true, 'true', show(sandbox.network?.strictAllowlist));
  need('permissions.defaultMode', permissions.defaultMode === 'auto', '"auto"', show(permissions.defaultMode));
  need('permissions.blockReadsOutsideWorkingDirectories', permissions.blockReadsOutsideWorkingDirectories === true, 'true', show(permissions.blockReadsOutsideWorkingDirectories));
  need('permissions.deny WebFetch', (permissions.deny ?? []).includes('WebFetch'), 'a deny entry', 'no deny entry');
  need('permissions.deny WebSearch', (permissions.deny ?? []).includes('WebSearch'), 'a deny entry', 'no deny entry');
  need('disableClaudeAiConnectors', doc.disableClaudeAiConnectors === true, 'true', show(doc.disableClaudeAiConnectors));
  need('permissions.disableBypassPermissionsMode', permissions.disableBypassPermissionsMode === 'disable', '"disable"', show(permissions.disableBypassPermissionsMode));
  const home = x.env.HOME;
  const root = x.projectReal;
  const covered = 'an entry that covers it';
  for (const path of [dataDir, `${home}/.cache/cdp6-core`, `${home}/.claude/teams`, `${root}/docs/cdp6/probes`, pluginDir, `${home}/.claude/plugins/cache/claude-skills/cdp5-gates`]) {
    need(`sandbox.filesystem.denyWrite ${path}`, sandboxCovers(doc, 'denyWrite', `${path}/x`, x.env), covered);
  }
  for (const path of [`${home}/.ssh`, `${home}/.aws`, `${home}/.config/gh`]) {
    need(`sandbox.filesystem.denyRead ${path}`, sandboxCovers(doc, 'denyRead', `${path}/x`, x.env) || credentialCovers(doc, `${path}/x`, x.env), `${covered} (or a credentials deny entry)`);
  }
  for (const sample of [`${root}/.env`, `${root}/.env.local`, `${root}/a/b/.env`]) {
    need(`sandbox.filesystem.denyRead sample ${sample}`, sandboxCovers(doc, 'denyRead', sample, x.env), `an entry that covers ${sample}`);
  }
  const pattern = `node ${resolve(pluginDir)}/scripts/run.mjs *`;
  need('sandbox.excludedCommands', JSON.stringify(sandbox.excludedCommands) === JSON.stringify([pattern]), `only "${pattern}"`, show(sandbox.excludedCommands));
  const domains = [...(sandbox.network?.allowedDomains ?? []), ...(permissions.allow ?? []).map((r) => WEB_FETCH_DOMAIN.exec(r)?.[1]).filter(Boolean)];
  need('sandbox.network.allowedDomains', !domains.some((d) => BROAD_DOMAINS.includes(d)), 'free of a bare * and of broad domains', show(domains.filter((d) => BROAD_DOMAINS.includes(d))));
  for (const m of missingRules(doc, x.env, { dataDir, pluginRoot: pluginDir })) fail('settings-file', m, `missing in ${settings}`, `add the ${m} to ${settings}`);
  info.push(`sandbox.allowUnsandboxedCommands ${sandbox.allowUnsandboxedCommands ?? 'not set'}`, `sandbox.failIfUnavailable ${sandbox.failIfUnavailable ?? 'not set'}`);
}

export function userSettings(x, fail) {
  if (!x.user) {
    fail('user-settings', '~/.claude/settings.json', 'not readable', 'create ~/.claude/settings.json with the rules of the concept section 5.6 items 9 and 10');
    return;
  }
  for (const m of missingRules(x.user, x.env, { dataDir: x.args.dataDir, pluginRoot: x.args.pluginDir })) fail('user-settings', m, 'missing in ~/.claude/settings.json', `add the ${m} to ~/.claude/settings.json`);
}

export function settingsLocation(x, fail) {
  if (!x.live.doc) return;
  let real;
  try {
    real = realpathSync(x.args.settings);
  } catch {
    real = resolve(x.args.settings);
  }
  const root = x.roots.find((r) => within(real, r));
  if (root) fail('settings-file', 'location', `the real path ${real} lies inside the sandbox-writable root ${root}`, 'move the --settings file outside every sandbox-writable root (the project tree, /tmp, $TMPDIR, allowWrite and additionalDirectories entries) and record its new sha256');
}

const MANAGED_KEYS = [
  'sandbox.enabled',
  'sandbox.failIfUnavailable',
  'sandbox.allowUnsandboxedCommands',
  'sandbox.network.strictAllowlist',
  'sandbox.network.allowedDomains',
  'sandbox.excludedCommands',
  'sandbox.filesystem.denyRead',
  'sandbox.filesystem.denyWrite',
  'sandbox.filesystem.allowRead',
  'sandbox.filesystem.allowWrite',
  'sandbox.credentials',
  'permissions.defaultMode',
  'permissions.deny',
  'permissions.allow',
  'permissions.blockReadsOutsideWorkingDirectories',
  'permissions.disableBypassPermissionsMode',
  'disableClaudeAiConnectors',
  'disableAllHooks',
  'allowManagedHooksOnly',
  'enabledPlugins',
];

const valueAt = (doc, path) => path.split('.').reduce((cur, k) => (cur && typeof cur === 'object' ? cur[k] : undefined), doc);

export function readManaged(dir) {
  const files = [];
  if (existsSync(join(dir, 'managed-settings.json'))) files.push('managed-settings.json');
  let dropIns = [];
  try {
    dropIns = readdirSync(join(dir, 'managed-settings.d')).filter((n) => n.endsWith('.json')).sort();
  } catch {
    dropIns = [];
  }
  files.push(...dropIns.map((n) => `managed-settings.d/${n}`));
  return files.map((name) => {
    const path = join(dir, name);
    try {
      const doc = JSON.parse(readFileSync(path, 'utf8'));
      return doc && typeof doc === 'object' && !Array.isArray(doc) ? { name, path, doc } : { name, path, doc: null, error: 'not a JSON object' };
    } catch {
      return { name, path, doc: null, error: 'not readable as JSON' };
    }
  });
}

export function managedSettings(x, fail, info) {
  for (const m of x.managed) {
    if (!m.doc) {
      fail('managed-settings', m.name, `${m.path} is ${m.error}`, `repair or remove ${m.path} as the administrator`);
      continue;
    }
    for (const key of MANAGED_KEYS) if (valueAt(m.doc, key) !== undefined) info.push(`managed settings ${m.path} sets ${key}`);
  }
  if (x.wsl) info.push('WSL: wslInheritsWindowsSettings would bring the Windows policy chain above the managed files read here; the host line of the owner confirms it off (concept section 5.6)');
}
