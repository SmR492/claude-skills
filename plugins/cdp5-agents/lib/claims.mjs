// Hedged completion claims in a worker's final answer. Worker contract rule 2: a claim carries its evidence, or the
// answer says plainly that the step was not verified. "Should work now" is neither. The SubagentStop hook asks once
// for a restatement; it does not judge whether the evidence is sufficient, that is review-verify's job.

const PATTERNS = [
  { re: /\b(should|probably|likely|presumably|hopefully|ought to)\s+(now\s+|all\s+)?(work|pass|be\s+(fixed|fine|ok|okay|correct|resolved|working|green)|succeed|compile|build|run)\b/i, why: 'hedged completion claim' },
  { re: /\b(seems?|appears?|looks?)\s+(to\s+(work|pass|be\s+(fixed|fine|correct|working))|fixed|fine|correct|good)\b/i, why: 'completion inferred from appearance' },
  { re: /\btests?\s+(should|probably|likely|will)\s+(all\s+)?pass\b/i, why: 'test result predicted, not run' },
  { re: /\b(I\s*(am|'m|’m)\s+confident|I\s+believe\s+(this|it|that)\s+(works|is\s+fixed|passes))\b/i, why: 'confidence offered instead of evidence' },
  { re: /^\s*(great|perfect|awesome|excellent|done|all\s+done|fixed)\s*!/im, why: 'satisfaction before verification' },
  { re: /\b(this\s+)?(fix|change|patch)\s+(should|will)\s+(resolve|fix|address)\b/i, why: 'effect of a change predicted, not shown' },
];

const EXEMPT_LINE = /unverified|not\s+verified|not\s+run|could\s+not\s+(run|verify)|nicht\s+(verifiziert|ausgeführt)|counter-test\s+not\s+executable|follow-up/i;

export function hedgedClaims(message) {
  const text = String(message ?? '');
  const out = [];
  let inFence = false;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^\s*[>|]/.test(line)) continue; // quotes and table rows carry other people's claims
    if (EXEMPT_LINE.test(line)) continue;
    for (const p of PATTERNS) {
      const m = p.re.exec(line);
      if (!m) continue;
      const before = line.slice(0, m.index);
      const quotes = (before.match(/["„“”']/g) ?? []).length;
      if (quotes % 2 === 1) continue; // inside a quotation
      out.push({ line: i + 1, text: line.trim().slice(0, 120), why: p.why });
      break;
    }
  }
  return out;
}

export function claimReason(hits) {
  const list = hits.slice(0, 5).map((h) => `line ${h.line} (${h.why}): ${h.text}`).join('\n');
  return `Worker contract rule 2: a claim carries its evidence or says that it was not verified. These lines predict or assume an outcome instead:\n${list}\nRestate the final answer: for each, give the command and output or file:line that shows it, or write plainly that it was not verified and what is missing.`;
}
