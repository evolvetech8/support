import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  verifySessionToken,
  checkPassword,
} from '../api/_lib/auth.js';

test('createSessionToken and verifySessionToken work with secret key', () => {
  const secretKey = 'super-secret-archonic-testing-key-123456';
  const token = createSessionToken(secretKey);
  assert.ok(token.includes('.'));

  const isValid = verifySessionToken(token, secretKey);
  assert.equal(isValid, true);

  const isInvalid = verifySessionToken(token, 'wrong-key');
  assert.equal(isInvalid, false);

  const isTampered = verifySessionToken(token + 'tamper', secretKey);
  assert.equal(isTampered, false);
});

test('checkPassword accurately compares against configured password', () => {
  const cfg = { dashboardPassword: 'MyArchonicSecret2026!' };
  assert.equal(checkPassword('MyArchonicSecret2026!', cfg), true);
  assert.equal(checkPassword('WrongPassword', cfg), false);
  assert.equal(checkPassword('', cfg), false);
});
