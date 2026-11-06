import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRoomCode, normalizeCode, normalizeName, normalizeToken, readBearer } from '../src/validation.js';

test('generateRoomCode makes a human-readable six character code', () => {
  const code = generateRoomCode();
  assert.equal(code.length, 6);
  assert.equal(normalizeCode(code), code);
});
test('name validation trims whitespace and rejects empty and long names', () => {
  assert.equal(normalizeName('  Лера   Зима  '), 'Лера Зима');
  assert.equal(normalizeName('   '), null);
  assert.equal(normalizeName('a'.repeat(25)), null);
});
test('room codes are normalized and invalid codes rejected', () => {
  assert.equal(normalizeCode('abc234'), 'ABC234');
  assert.equal(normalizeCode('OI01AB'), null);
});
test('bearer token parser does not accept arbitrary values', () => {
  const uuid = 'e0e1c782-7a1d-4ef5-a785-819b2e05b318';
  assert.equal(readBearer(`Bearer ${uuid}`), uuid);
  assert.equal(readBearer('Bearer bad'), null);
  assert.equal(readBearer(`Bearer ${'-'.repeat(36)}`), null);
});

test('socket tokens must be UUID strings', () => {
  for (const token of [null, undefined, {}, [], 123, 'bad', '-'.repeat(36), 'a'.repeat(36)]) {
    assert.equal(normalizeToken(token), null);
  }
  assert.equal(normalizeToken('E0E1C782-7A1D-4EF5-A785-819B2E05B318'), 'e0e1c782-7a1d-4ef5-a785-819b2e05b318');
});
