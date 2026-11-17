import { roomLimit } from './config.js';
import { pool, withTransaction } from './db.js';
import { generateRoomCode, normalizeToken } from './validation.js';

export class RoomError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export async function getRoom(code, db = pool) {
  const { rows } = await db.query(
    `SELECT id, code, created_at, expires_at, owner_id, filters, selection, revision FROM rooms
     WHERE code = $1 AND expires_at > now()`, [code]
  );
  if (!rows.length) return null;
  const room = rows[0];
  const members = await db.query(
    `SELECT id, display_name, created_at, EXISTS(SELECT 1 FROM participant_connections c WHERE c.participant_id=participants.id AND c.expires_at>now()) AS online FROM participants
     WHERE room_id = $1 ORDER BY created_at, id`, [room.id]
  );
  return { code: room.code, expiresAt: room.expires_at, ownerId: room.owner_id, filters: room.filters, selection: room.selection, revision: room.revision, participants: members.rows.map(p => ({ id: p.id, name: p.display_name, online: p.online })), maxParticipants: roomLimit };
}

export async function verifyMember(code, token, db = pool) {
  token = normalizeToken(token);
  if (!token) return null;
  const { rows } = await db.query(
    `SELECT p.id, p.display_name FROM participants p
     JOIN rooms r ON r.id = p.room_id
     WHERE r.code = $1 AND r.expires_at > now() AND p.session_token = $2`,
    [code, token]
  );
  return rows[0] || null;
}

export async function createRoom(name) {
  return withTransaction(async client => {
    let code;
    let roomId;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        await client.query('SAVEPOINT room_code_try');
        code = generateRoomCode();
        const { rows } = await client.query(
          'INSERT INTO rooms(code) VALUES($1) RETURNING id', [code]
        );
        roomId = rows[0].id;
        await client.query('RELEASE SAVEPOINT room_code_try');
        break;
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT room_code_try');
        if (error.code !== '23505') throw error;
      }
    }
    if (!roomId) throw new RoomError('Не удалось создать комнату', 503);
    const { rows } = await client.query(
      `INSERT INTO participants(room_id, display_name)
       VALUES($1,$2) RETURNING id, session_token`, [roomId, name]
    );
    await client.query('UPDATE rooms SET owner_id=$2 WHERE id=$1', [roomId, rows[0].id]);
    const room = await getRoom(code, client);
    return { room, participant: { id: rows[0].id, name, token: rows[0].session_token } };
  });
}

export async function joinRoom(code, name) {
  return withTransaction(async client => {
    const { rows } = await client.query(
      'SELECT id FROM rooms WHERE code=$1 AND expires_at > now() FOR UPDATE', [code]
    );
    if (!rows.length) throw new RoomError('Комната не найдена или срок её действия истёк', 404);
    const id = rows[0].id;
    const count = await client.query('SELECT count(*)::int AS n FROM participants WHERE room_id=$1', [id]);
    if (count.rows[0].n >= roomLimit) throw new RoomError('Комната уже заполнена', 409);
    const member = await client.query(
      'INSERT INTO participants(room_id, display_name) VALUES($1,$2) RETURNING id, session_token',
      [id, name]
    );
    await client.query('UPDATE rooms SET owner_id=COALESCE(owner_id,$2), revision=revision+1 WHERE id=$1', [id,member.rows[0].id]);
    const room = await getRoom(code, client);
    return { room, participant: { id: member.rows[0].id, name, token: member.rows[0].session_token } };
  });
}

export async function leaveRoom(code, token) {
  return withTransaction(async client => {
    const { rows } = await client.query('SELECT id,owner_id,selection FROM rooms WHERE code=$1 AND expires_at>now() FOR UPDATE', [code]);
    if (!rows.length) throw new RoomError('Комната не найдена', 404);
    const deleted = await client.query(
      'DELETE FROM participants WHERE room_id=$1 AND session_token=$2 RETURNING id', [rows[0].id, token]
    );
    if (!deleted.rowCount) throw new RoomError('Участник не найден', 403);
    const row=rows[0];
    if(row.selection?.participants?.some(p=>p.id===deleted.rows[0].id)) {
      row.selection.cancelled=true;
      await client.query('UPDATE selection_sessions SET cancelled=true WHERE id=$1',[row.selection.id]);
      await client.query('UPDATE rooms SET selection=$2 WHERE id=$1',[row.id,JSON.stringify(row.selection)]);
    }
    if(row.owner_id===deleted.rows[0].id) {
      const next=(await client.query('SELECT id FROM participants WHERE room_id=$1 ORDER BY EXISTS(SELECT 1 FROM participant_connections c WHERE c.participant_id=participants.id AND c.expires_at>now()) DESC,created_at,id LIMIT 1',[row.id])).rows[0];
      await client.query('UPDATE rooms SET owner_id=$2 WHERE id=$1',[row.id,next?.id ?? null]);
    }
    await client.query('UPDATE rooms SET revision=revision+1 WHERE id=$1',[row.id]);
    return getRoom(code, client);
  });
}
