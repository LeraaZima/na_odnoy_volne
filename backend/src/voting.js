import { withTransaction } from './db.js';
import { verifyMember, RoomError } from './rooms.js';
import { normalizeToken } from './validation.js';

export function validateVote(body) {
  if (!normalizeToken(body?.selectionId) || !['string','number'].includes(typeof body?.movieId) || !/^[1-9]\d{0,14}$/.test(String(body?.movieId)) || !['like','dislike'].includes(body?.choice)) {
    throw new RoomError('Проверьте сессию, фильм и оценку');
  }
  return { selectionId: normalizeToken(body.selectionId), movieId: String(body.movieId), choice: body.choice };
}

async function lockRoom(client, code, token) {
  // Тот же замок используют выход, вход и смена подборки: пара не меняется посреди голосования.
  const { rows } = await client.query('SELECT * FROM rooms WHERE code=$1 FOR UPDATE', [code]);
  const room = rows[0];
  if (!room || new Date(room.expires_at).getTime() <= Date.now()) throw new RoomError('Комната недоступна',403);
  const member = await verifyMember(code,token,client);
  if (!member) throw new RoomError('Нет доступа к комнате',403);
  return { room, member };
}

async function stateFor(client,room,member) {
  const votes = room.selection ? (await client.query(
    'SELECT movie_tmdb_id::text AS "movieId",choice FROM votes WHERE selection_id=$1 AND participant_id=$2 ORDER BY created_at,movie_tmdb_id',
    [room.selection.id,member.id]
  )).rows : [];
  const matches = (await client.query(
    'SELECT id,selection_id AS "selectionId",movie,participants,created_at AS "createdAt" FROM matches WHERE room_id=$1 ORDER BY created_at,id', [room.id]
  )).rows;
  return { selectionId: room.selection?.id ?? null, version:room.voting_revision, eligible:room.selection?.participants?.some(p=>p.id===member.id) ?? false, cancelled:room.selection?.cancelled ?? false, votes, matches };
}

export async function getVotingState(code,token) {
  return withTransaction(async client => {
    const {room,member}=await lockRoom(client,code,token);
    return stateFor(client,room,member);
  });
}

export async function saveVote(code,token,body) {
  const vote=validateVote(body);
  return withTransaction(async client => {
    const {room,member}=await lockRoom(client,code,token);
    if (room.selection?.id !== vote.selectionId) throw new RoomError('Подборка изменилась. Откройте текущую колоду.',409);
    if(!room.selection.participants?.some(p=>p.id===member.id)) throw new RoomError('Вы ожидаете следующего раунда',403);
    const movie=room.selection.movies.find(m=>String(m.id)===vote.movieId);
    if (!movie) throw new RoomError('Фильм отсутствует в текущей колоде');
    const previous=(await client.query('SELECT choice FROM votes WHERE selection_id=$1 AND participant_id=$2 AND movie_tmdb_id=$3',[vote.selectionId,member.id,vote.movieId])).rows[0];
    if (previous) {
      if(previous.choice!==vote.choice) throw new RoomError('Фильм уже оценён. Изменение голоса недоступно.',409);
      return { state: await stateFor(client,room,member), match:null, inserted:false };
    }
    if(room.selection.cancelled) throw new RoomError('Участник вышел. Нужен новый раунд.',409);
    const rated=(await client.query('SELECT movie_tmdb_id::text AS id FROM votes WHERE selection_id=$1 AND participant_id=$2',[vote.selectionId,member.id])).rows;
    const ids=new Set(rated.map(v=>v.id));
    const next=room.selection.movies.find(m=>!ids.has(String(m.id)));
    if (String(next?.id)!==vote.movieId) throw new RoomError('Сначала оцените текущую карточку. Прогресс обновлён.',409);
    await client.query('INSERT INTO votes(room_id,selection_id,participant_id,movie_tmdb_id,choice) VALUES($1,$2,$3,$4,$5)',[room.id,vote.selectionId,member.id,vote.movieId,vote.choice]);
    let match=null;
    if(vote.choice==='like') {
      const roster=room.selection.participants;
      const likes=(await client.query("SELECT count(*)::int AS n FROM votes WHERE selection_id=$1 AND movie_tmdb_id=$2 AND choice='like' AND participant_id=ANY($3::uuid[])",[vote.selectionId,vote.movieId,roster.map(p=>p.id)])).rows[0].n;
      if(roster.length>=2 && likes===roster.length) {
        match=(await client.query(`INSERT INTO matches(room_id,selection_id,movie_tmdb_id,movie,participants) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT(selection_id,movie_tmdb_id) DO NOTHING RETURNING id,selection_id AS "selectionId",movie,participants,created_at AS "createdAt"`,[room.id,vote.selectionId,vote.movieId,JSON.stringify(movie),JSON.stringify(roster)])).rows[0] ?? null;
      }
    }
    room.voting_revision=(await client.query('UPDATE rooms SET voting_revision=voting_revision+1 WHERE id=$1 RETURNING voting_revision',[room.id])).rows[0].voting_revision;
    return {state:await stateFor(client,room,member),match,inserted:true};
  });
}
