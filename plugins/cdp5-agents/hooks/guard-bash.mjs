#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { readStdinJson } from '../lib/contract.mjs';

export const PLUGIN_PREFIXES = ['cdp5-agents:', 'domain-agents:'];

// Workers that may write inside their worktree but never commit or push.
export const WRITING_WORKERS = new Set(['impl-debug', 'impl-uc', 'impl-refactor']);

export const VCS_PATTERNS = [
  /\bgit\s+(commit|push|pull|fetch|rebase|merge|reset\s+--hard|cherry-pick|branch\s+-[dD]|tag\s|clean|am|init|clone|worktree\s+(remove|prune))\b/,
  /\bgit\s+(checkout|switch)\s+(-b\s+)?\S*\s*$/,
];

export const WRITE_PATTERNS = [
  ...VCS_PATTERNS,
  /(^|[^<>])>{1,2}(?!&)/,
  /\btee\b/,
  /\b(rm|mv|cp|mkdir|touch|chmod|chown|truncate|dd|ln)\b/,
  /\bsed\b[^|]*\s-[a-zA-Z]*i\b/,
  /\bgit\s+(add|checkout|switch|reset|stash|rm|mv|restore|apply|worktree\s+add)\b/,
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

export function agentName(agentType) {
  const t = String(agentType ?? '');
  const prefix = PLUGIN_PREFIXES.find((p) => t.startsWith(p));
  return prefix ? t.slice(prefix.length) : null;
}

export function isVcsCommand(command) {
  const c = String(command ?? '');
  return VCS_PATTERNS.some((re) => re.test(c));
}

export function isWriteCommand(command) {
  const c = String(command ?? '');
  return WRITE_PATTERNS.some((re) => re.test(c));
}

export function decide(input) {
  const name = agentName(input.agent_type);
  if (!name) return null;
  if (input.tool_name !== 'Bash') return null;
  const command = input.tool_input?.command ?? '';
  const writer = WRITING_WORKERS.has(name);
  const blocked = writer ? isVcsCommand(command) : isWriteCommand(command);
  if (!blocked) return null;
  const reason = writer
    ? `Implementation workers deliver a diff; they do not commit, push, fetch or rewrite history (worker contract rule 8). Blocked: ${command.slice(0, 120)}`
    : `This agent runs read-only commands only (worker contract rule 8). This command looks like it writes or mutates: ${command.slice(0, 120)}. Use a read-only form, or report "counter-test not executable" when a run would be needed.`;
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}

export function main() {
  const out = decide(readStdinJson());
  if (out) process.stdout.write(JSON.stringify(out));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
