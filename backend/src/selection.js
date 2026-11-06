import { randomUUID } from 'node:crypto';
import { withTransaction } from './db.js';
import { getRoom, verifyMember, RoomError } from './rooms.js';
import { listMovies } from './movieRepository.js';

export function validateSelectionFilters(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RoomError('Проверьте фильтры');
  const keys = ['genreIds', 'yearFrom', 'yearTo', 'minRating', 'maxRuntime'];
  if (Object.keys(input).some(k => !keys.includes(k))) throw new RoomError('Неизвестный фильтр');
  const genreIds = input.genreIds ?? [];
  if (!Array.isArray(genreIds) || genreIds.length > 30 || genreIds.some(id => !Number.isInteger(id) || id < 1 || id > 99999)) throw new RoomError('Проверьте жанры');
  const result = { genreIds: [...new Set(genreIds)].sort((a,b) => a-b) };
  for (const [key,min,max,whole] of [['yearFrom',1880,2200,true],['yearTo',1880,2200,true],['minRating',0,10,false],['maxRuntime',1,1000,true]]) {
    const value = input[key] ?? null;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || whole && !Number.isInteger(value))) throw new RoomError('Проверьте годы, рейтинг и длительность');
    result[key] = value;
  }
  if (result.yearFrom !== null && result.yearTo !== null && result.yearFrom > result.yearTo) throw new RoomError('Начальный год не может быть больше конечного');
  return result;
}

export async function changeSelection(code, token, body, start = false) {
  return withTransaction(async client => {
    const { rows } = await client.query('SELECT * FROM rooms WHERE code=$1 AND expires_at>now() FOR UPDATE', [code]);
    const row = rows[0];
    const member = row && await verifyMember(code, token, client);
    if (!member) throw new RoomError('Нет доступа к комнате', 403);
    if (row.owner_id !== member.id) throw new RoomError('Настройки меняет только создатель комнаты', 403);
    if (!Number.isInteger(body?.revision) || body.revision !== row.revision) throw new RoomError('Настройки уже изменились. Обновите комнату и повторите.', 409);
    if (start) {
      // Повторный запрос с актуальной версией не создаёт новую колоду.
      if (!row.selection) {
        const movies = await listMovies({ ...row.filters, genreId: null, limit: 200, offset: 0 }, client);
        const selection = { id: randomUUID(), startedAt: new Date().toISOString(), movies };
        await client.query('INSERT INTO selection_sessions(id,room_id,snapshot) VALUES($1,$2,$3)', [selection.id,row.id,JSON.stringify(selection)]);
        await client.query('UPDATE rooms SET selection=$2, revision=revision+1 WHERE id=$1', [row.id, JSON.stringify(selection)]);
      }
    } else {
      const filters = validateSelectionFilters(body.filters);
      const known = await client.query('SELECT tmdb_id FROM tmdb_genres WHERE tmdb_id=ANY($1::int[])', [filters.genreIds]);
      if (known.rowCount !== filters.genreIds.length) throw new RoomError('Выбран неизвестный жанр');
      await client.query('UPDATE rooms SET filters=$2, selection=NULL, revision=revision+1 WHERE id=$1', [row.id, JSON.stringify(filters)]);
    }
    return getRoom(code, client);
  });
}
