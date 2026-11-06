import test from 'node:test';
import assert from 'node:assert/strict';

test('истёкшая комната недоступна через API', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  const { pool } = await import('../src/db.js');
  let code;
  try {
    const response = await fetch('http://localhost:3001/api/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Проверка срока' }),
    });
    assert.equal(response.status, 201);
    const { room, participant } = await response.json();
    code = room.code;
    await pool.query("UPDATE rooms SET expires_at = now() - interval '1 second' WHERE code = $1", [code]);
    const read = await fetch(`http://localhost:3001/api/rooms/${code}`, { headers: { Authorization: `Bearer ${participant.token}` } });
    assert.equal(read.status, 403);
    const join = await fetch(`http://localhost:3001/api/rooms/${code}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Гость' }),
    });
    assert.equal(join.status, 404);
  } finally {
    if (code) await pool.query('DELETE FROM rooms WHERE code = $1', [code]);
    await pool.end();
  }
});
