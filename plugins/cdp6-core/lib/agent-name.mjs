export const PLUGIN_PREFIXES = ['cdp6-core:'];
export const WRITING_WORKERS = new Set(['impl-debug', 'impl-uc', 'impl-refactor']);

export function agentName(agentType) {
  const t = String(agentType ?? '');
  const prefix = PLUGIN_PREFIXES.find((p) => t.startsWith(p));
  return prefix ? t.slice(prefix.length) : null;
}
