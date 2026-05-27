// Kanonische Tripel-Serialisierung + content-adressierter Hash.
// Wire-Vertrag v1 (KONZEPT §8.3): NFC-Normalisierung, Trennzeichen 0x1F,
// kein Trim/Case-Fold, sha256:-Präfix. MUSS byte-identisch zur PHP-Seite sein.
import { createHash } from 'node:crypto';

const US = '\x1f'; // U+001F Unit Separator

export function canonicalInput(subject, predicate, object) {
  return [subject, predicate, object]
    .map((s) => String(s).normalize('NFC'))
    .join(US);
}

export function tripleHash(subject, predicate, object) {
  const hex = createHash('sha256')
    .update(Buffer.from(canonicalInput(subject, predicate, object), 'utf8'))
    .digest('hex');
  return `sha256:${hex}`;
}
