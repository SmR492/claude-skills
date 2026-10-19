export const PLUGIN_PREFIXES = ['cdp5-agents:', 'domain-agents:'];
// Implementation workers: the worker tier without a grant (runs and writes in their environment, git worktree-local only).
export const WRITING_WORKERS = new Set(['impl-debug', 'impl-uc', 'impl-refactor']);

// Returns the agent name without the plugin prefix, or null when the agent type does not belong to these plugins.
export function agentName(agentType) {
  const t = String(agentType ?? '');
  const prefix = PLUGIN_PREFIXES.find((p) => t.startsWith(p));
  return prefix ? t.slice(prefix.length) : null;
}
