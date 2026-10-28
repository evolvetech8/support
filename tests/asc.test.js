import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { generateAscJwt } from '../api/_lib/asc.js';

test('generateAscJwt creates valid 3-part JWT using EC prime256v1 key', () => {
  const { privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const jwt = generateAscJwt({
    issuerId: '57246542-96fe-1a63-e053-0824d011072a',
    keyId: '2X9R4HXF34',
    privateKey,
  });

  assert.ok(jwt);
  const parts = jwt.split('.');
  assert.equal(parts.length, 3);

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  assert.equal(header.alg, 'ES256');
  assert.equal(header.kid, '2X9R4HXF34');

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  assert.equal(payload.iss, '57246542-96fe-1a63-e053-0824d011072a');
  assert.equal(payload.aud, 'appstoreconnect-v1');
  assert.ok(payload.exp > payload.iat);
});
