#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { readStdinJson } from '../lib/contract.mjs';

export const WRITE_PATTERNS = [
  /(^|[^<>])>{1,2}(?!&)/,
  /\btee\b/,
  /\b(rm|mv|cp|mkdir|touch|chmod|chown|truncate|dd|ln)\b/,
  /\bsed\b[^|]*\s-[a-zA-Z]*i\b/,
  /\bgit\s+(commit|push|add|checkout|switch|reset|rebase|merge|stash|cherry-pick|rm|mv|clean|branch\s+-[dD]|tag\s|restore|apply|am|pull|fetch|init|clone|worktree\s+(add|remove|prune))\b/,
  /\b(npm|pnpm|yarn|bun)\s+(i|install|add|remove|uninstall|update|publish|run|exec|ci)\b/,
  /\b(pip3?|poetry|uv)\s+(install|uninstall|add|remove)\b/,
  /\b(composer)\s+(install|update|require|remove)\b/,
  /\bdocker(\s+compose)?\s+(run|exec|build|rm|rmi|up|down|push|pull|stop|kill|start|restart|create|volume|network)\b/,
  /\bcurl\b[^|]*\s(-X\s*(POST|PUT|PATCH|DELETE)|--data|-d\s|--upload-file|-T\s|-F\s|--form)/,
  /\bwget\b/,
  /\b(apt(-get)?|brew|dnf|yum|pacman)\s+(install|remove|upgrade|update)\b/,
  /\b(php|node|python3?|ruby|perl)\b[^|]*\s(artisan|console|bin\/console|migrate|manage\.py)\b/,
  /\bkill(all)?\b|\bpkill\b|\bsystemctl\b|\bservice\b\s/,
  /\bcrontab\b|\bshutdown\b|\breboot\b/,
];

export function isWriteCommand(command) {
  const c = String(command ?? '');
  return WRITE_PATTERNS.some((re) => re.test(c));
}

export function decide(input) {
  const agent = String(input.agent_type ?? '');
  if (!agent.startsWith('cdp5-agents:')) return null;
  if (input.tool_name !== 'Bash') return null;
  const command = input.tool_input?.command ?? '';
  if (!isWriteCommand(command)) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `cdp5-agents workers run read-only commands only (worker contract rule 8). This command looks like it writes or mutates: ${command.slice(0, 120)}. Use a read-only form, or report "counter-test not executable" when a run would be needed.`,
    },
  };
}

export function main() {
  const out = decide(readStdinJson());
  if (out) process.stdout.write(JSON.stringify(out));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
