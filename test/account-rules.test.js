// Password and phone rules (shared by browser and server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword, passwordStrength, normalizePhone, isValidFullPhone } from '../js/account-rules.js';

test('weak passwords are refused', () => {
  for (const p of ['12345678', 'short1', 'abcdefgh', '98765432', 'Password1', 'qwerty123', 'aaaaaaaa1'.slice(0, 8)]) {
    assert.ok(validatePassword(p), `${p} was accepted`);
  }
});

test("passwords can't contain the email or center name", () => {
  assert.ok(validatePassword('ravi2024!x', { email: 'ravi@example.com' }));
  assert.ok(validatePassword('Brightminds9', { name: 'Bright Minds Academy' }));
});

test('reasonable passwords pass', () => {
  for (const p of ['Monsoon-Rain7', 'tiger7lamp', 'K8#vq2mzXp']) assert.equal(validatePassword(p, { email: 'ravi@example.com', name: 'Bright Minds' }), null, p);
  assert.ok(passwordStrength('K8#vq2mzXp!Long') >= 3);
  assert.ok(passwordStrength('12345678') <= 1);
});

test('phone numbers get a country code and are checked', () => {
  assert.deepEqual(normalizePhone('+91', '98765 43210'), { phone: '+919876543210', error: null });
  assert.deepEqual(normalizePhone('+91', '09876543210'), { phone: '+919876543210', error: null });
  assert.ok(normalizePhone('+91', '12345').error);
  assert.ok(normalizePhone('+91', '5876543210').error, 'Indian mobiles start with 6-9');
  assert.ok(normalizePhone('+91', '98765abc10').error);
  assert.deepEqual(normalizePhone('+971', '501234567'), { phone: '+971501234567', error: null });
  assert.deepEqual(normalizePhone('+91', ''), { phone: null, error: null });
  assert.equal(isValidFullPhone('+919876543210'), true);
  assert.equal(isValidFullPhone('9876543210'), false);
  assert.equal(isValidFullPhone('+91123'), false);
});
