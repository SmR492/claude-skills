import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findTestGaps } from './test-gap.mjs';

test('findet ungetestete Voter, ignoriert getestete + nicht-sicherheitskritische', () => {
  const root = mkdtempSync(join(tmpdir(), 'tg-'));
  try {
    mkdirSync(join(root, 'src/Security'), { recursive: true });
    mkdirSync(join(root, 'src/Service'), { recursive: true });
    mkdirSync(join(root, 'tests'), { recursive: true });
    writeFileSync(join(root, 'src/Security/ArticleVoter.php'), '<?php\nclass ArticleVoter extends Voter {}\n');   // getestet
    writeFileSync(join(root, 'src/Security/AdminVoter.php'), '<?php\nclass AdminVoter extends Voter {}\n');       // KEIN Test
    writeFileSync(join(root, 'src/Service/PlainService.php'), '<?php\nclass PlainService {}\n');                  // nicht sicherheitskritisch
    writeFileSync(join(root, 'tests/ArticleVoterTest.php'), '<?php\nclass ArticleVoterTest {}\n');
    const r = findTestGaps(root);
    assert.deepEqual(r.gaps.map((g) => g.class), ['AdminVoter']);
    assert.ok(r.covered.some((c) => c.class === 'ArticleVoter'));
    assert.ok(!r.gaps.some((g) => g.class === 'PlainService'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
