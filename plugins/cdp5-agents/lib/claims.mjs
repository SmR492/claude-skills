// Hedged completion claims in a worker's final answer. Worker contract rule 2: a claim carries its evidence, or the
// answer says plainly that the step was not verified. "Should work now" is neither. The SubagentStop hook asks once
// for a restatement; it does not judge whether the evidence is sufficient, that is review-verify's job.

const HEDGE = '(should|probably|likely|presumably|hopefully|ought\\s+to)';
const OUTCOME = '(work|pass|succeed|compile|build|run|be\\s+(fixed|fine|ok|okay|correct|resolved|working|green|good|done|complete|good\\s+to\\s+go))';
// The claim needs a subject that names the delivered thing; "the voter should be fixed" is a proposal, not a claim.
// The noun may carry up to two modifiers ("the user's endpoint", "the new test suite") and up to four words may sit
// between the subject and the hedge ("the fix is in place and should work").
const SUBJECT = "(it|this|that|everything|the\\s+(?:[\\w'’]+\\s+){0,2}(fix|change|patch|build|endpoint|tests?|suite))";

const PATTERNS = [
  { re: new RegExp(`\\b${SUBJECT}(?:\\s+\\w+){0,4}?\\s+${HEDGE}\\s+(now\\s+|all\\s+)?${OUTCOME}\\b`, 'i'), why: 'hedged completion claim' },
  // A sentence that opens with the hedge has the delivered thing as its implied subject: "Should work now."
  { re: new RegExp(`(^|[.!?:;]\\s+)${HEDGE}\\s+(now\\s+|all\\s+)?${OUTCOME}\\b`, 'i'), why: 'hedged completion claim' },
  { re: /\b(seems?|appears?|looks?)\s+(to\s+(work|pass|be\s+(fixed|fine|correct|working))|fixed|fine|correct|good)\b/i, why: 'completion inferred from appearance' },
  { re: /\btests?\s+(should|probably|likely|will)\s+(all\s+)?pass\b/i, why: 'test result predicted, not run' },
  { re: /\b(is|are)\s+expected\s+to\s+(work|pass|succeed)\b/i, why: 'outcome expected, not shown' },
  { re: /\b(I\s*(am|'m|’m)\s+confident|I\s+believe\s+(this|it|that)\s+(works|is\s+fixed|passes))\b/i, why: 'confidence offered instead of evidence' },
  { re: /^\s*(great|perfect|awesome|excellent|done|all\s+done|fixed)\s*!/im, why: 'satisfaction before verification' },
  { re: /\b(this\s+)?(fix|change|patch)\s+(should|will)\s+(resolve|fix|address)\b/i, why: 'effect of a change predicted, not shown' },
];

// A line that carries evidence (exit status, file:line, a command, a test count) is a claim with its evidence.
const EVIDENCE_LINE = /→\s*exit\b|\bexit\s+\d+\b|\b[\w./-]+\.[a-z]{1,5}:\d+\b|`[^`]+`|\b\d+\/\d+\b/i;
// Labels that open a sentence: what follows is a follow-up or an honest non-verification, not a completion claim.
const EXEMPT_SENTENCE_START = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?(?:\*\*|__)?\s*(follow-up|unverified|not\s+verified|not\s+run|counter-test\s+not\s+executable)\b/i;
// Markers that qualify the sentence they stand in, wherever they stand.
const EXEMPT_SENTENCE = /\bunverified\b|\bnot\s+verified\b|\bnot\s+run\b|could\s+not\s+(run|verify)|nicht\s+(verifiziert|ausgeführt)|counter-test\s+not\s+executable/i;

function sentenceAround(line, start, end) {
  // The sentence that contains [start, end): bounded by ". ", "! ", "? " or "; " on either side.
  let from = 0;
  const boundary = /[.!?;]\s/g;
  let m;
  while ((m = boundary.exec(line)) && m.index < start) from = m.index + m[0].length;
  boundary.lastIndex = end;
  const tail = boundary.exec(line);
  return line.slice(from, tail ? tail.index + 1 : line.length);
}

function insideQuotes(line, index) {
  // Counts quotation marks before index. A straight apostrophe opens a quotation only at a word start (preceded by
  // start of line, whitespace or an opening bracket) and closes one only when a quotation is open and a word ends
  // (followed by whitespace, punctuation or the end), so "the user's endpoint" has no quote in it.
  let open = 0;
  let singleOpen = false;
  for (let k = 0; k < index; k++) {
    const ch = line[k];
    if (/["„“”]/.test(ch)) { open++; continue; }
    if (ch !== "'") continue;
    const prev = k === 0 ? ' ' : line[k - 1];
    const next = k + 1 < line.length ? line[k + 1] : ' ';
    if (/[\s([{]/.test(prev)) { open++; singleOpen = true; continue; }
    if (singleOpen && /[\s.,;:!?)\]}]/.test(next)) { open++; singleOpen = false; }
  }
  return open % 2 === 1;
}

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
    if (EVIDENCE_LINE.test(line)) continue;
    for (const p of PATTERNS) {
      const m = p.re.exec(line);
      if (!m) continue;
      if (insideQuotes(line, m.index)) continue;
      const sentence = sentenceAround(line, m.index, m.index + m[0].length);
      if (EXEMPT_SENTENCE_START.test(sentence) || EXEMPT_SENTENCE.test(sentence)) continue;
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
