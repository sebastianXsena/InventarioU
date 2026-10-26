const test = require('node:test');
const assert = require('node:assert/strict');

const {
  userSchema,
  labSchema,
  reservationSchema,
} = require('../src/validators');

test('register schema normalizes valid user data', () => {
  const { error, value } = userSchema.register.validate({
    name: ' Ana Torres ',
    email: 'ANA@EXAMPLE.COM',
    password: 'secure-password',
  });

  assert.equal(error, undefined);
  assert.deepEqual(value, {
    name: 'Ana Torres',
    email: 'ana@example.com',
    password: 'secure-password',
    role: 'student',
  });
});

test('register schema rejects short passwords', () => {
  const { error } = userSchema.register.validate({
    name: 'Ana Torres',
    email: 'ana@example.com',
    password: 'short',
  });

  assert.notEqual(error, undefined);
  assert.match(error.message, /at least 8 characters/);
});

test('lab schema rejects a blocked schedule whose end precedes its start', () => {
  const { error } = labSchema.create.validate({
    name: 'Laboratorio 1',
    location: 'Bloque A',
    capacity: 30,
    blocked_schedule: [{ day_of_week: 1, start: '14:00', end: '13:00' }],
  });

  assert.notEqual(error, undefined);
});

test('reservation schema requires an end time after the start time', () => {
  const { error } = reservationSchema.create.validate({
    lab_id: '550e8400-e29b-41d4-a716-446655440000',
    start_time: '2026-10-27T14:00:00.000Z',
    end_time: '2026-10-27T13:00:00.000Z',
  });

  assert.notEqual(error, undefined);
});
