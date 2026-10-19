export const PLUGIN_PREFIXES = ['cdp5-agents:', 'domain-agents:'];

// Returns the agent name without the plugin prefix, or null when the agent type does not belong to these plugins.
export function agentName(agentType) {
  const t = String(agentType ?? '');
  const prefix = PLUGIN_PREFIXES.find((p) => t.startsWith(p));
  return prefix ? t.slice(prefix.length) : null;
}
