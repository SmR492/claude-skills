// Peer-Identität + Ed25519-Signatur (KONZEPT UC-01/06/09, Wire-Vertrag v1).
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
  verify as edVerify,
  createHash,
} from 'node:crypto';

export function createIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return { publicKeyPem, privateKeyPem, fingerprint: fingerprint(publicKeyPem) };
}

// TOFU-Fingerprint (UC-09): SHA-256 über den DER-Public-Key, hex.
export function fingerprint(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(der).digest('hex');
}

// Deterministische Signier-Repräsentation eines Tripels (stabile Feldordnung).
export function signingString(t) {
  return JSON.stringify([
    t.wire_version,
    t.triple_hash,
    t.subject,
    t.predicate,
    t.object,
    t.confidence,
    t.temporality,
    t.origin_peer_id,
    t.vector_clock,
    t.derived_from ?? null,
  ]);
}

export function signTriple(privateKeyPem, triple) {
  const key = createPrivateKey(privateKeyPem);
  const sig = edSign(null, Buffer.from(signingString(triple), 'utf8'), key);
  return `ed25519:${sig.toString('base64')}`;
}

export function verifyTriple(publicKeyPem, triple, signature) {
  if (typeof signature !== 'string' || !signature.startsWith('ed25519:')) return false;
  try {
    const key = createPublicKey(publicKeyPem);
    const sig = Buffer.from(signature.slice('ed25519:'.length), 'base64');
    return edVerify(null, Buffer.from(signingString(triple), 'utf8'), key, sig);
  } catch {
    return false;
  }
}
