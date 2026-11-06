import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSelectionFilters } from '../src/selection.js';

test('фильтры подборки: несколько жанров, диапазон и строгие типы', () => {
  assert.deepEqual(validateSelectionFilters({ genreIds: [35,28,35], yearFrom: 2000, minRating: 7.5 }), { genreIds: [28,35], yearFrom: 2000, yearTo: null, minRating: 7.5, maxRuntime: null });
  for (const body of [null, [], { genreIds: '28' }, { genreIds: [0] }, { yearFrom: '2000' }, { yearFrom: 2020, yearTo: 2000 }, { minRating: 11 }, { maxRuntime: 2.5 }, { mood: 'fun' }]) assert.throws(() => validateSelectionFilters(body));
});

test('подборка: права, реальная фильтрация, сохранённый порядок, конфликт версии и истечение срока', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  const { pool } = await import('../src/db.js');
  let code;
  async function api(path, method='GET', token, body) {
    const r = await fetch(`http://localhost:3001/api${path}`, { method, headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) });
    return { status:r.status, ...await r.json() };
  }
  try {
    const created = await api('/rooms','POST',null,{name:'Тест ведущий'});
    code = created.room.code;
    const token = created.participant.token;
    assert.equal(created.room.ownerId, created.participant.id);
    const guest = await api(`/rooms/${code}/join`,'POST',null,{name:'Тест гость'});
    const genres = (await api('/movies/genres')).genres.slice(0,2).map(g => g.id);
    const filters = { genreIds:genres, yearFrom:1900, yearTo:2200, minRating:0, maxRuntime:1000 };
    for (const who of [null, guest.participant.token]) {
      assert.equal((await api(`/rooms/${code}/filters`,'PUT',who,{filters,revision:0})).status,403);
      assert.equal((await api(`/rooms/${code}/selection`,'POST',who,{revision:0})).status,403);
    }
    assert.equal((await api(`/rooms/${code}/filters`,'PUT',token,{filters:{genreIds:[99999]},revision:0})).status,400);
    const saved = await api(`/rooms/${code}/filters`,'PUT',token,{filters,revision:0});
    assert.equal(saved.status,200);
    const started = await api(`/rooms/${code}/selection`,'POST',token,{revision:saved.room.revision});
    assert.equal(started.status,200);
    const expected = await pool.query(`SELECT tmdb_id::text FROM movies m WHERE adult=false AND EXTRACT(YEAR FROM release_date) BETWEEN 1900 AND 2200 AND vote_average>=0 AND runtime<=1000 AND EXISTS(SELECT 1 FROM movie_genres mg WHERE mg.movie_tmdb_id=m.tmdb_id AND mg.genre_tmdb_id=ANY($1::int[])) ORDER BY popularity DESC NULLS LAST,tmdb_id LIMIT 200`,[genres]);
    assert.deepEqual(started.room.selection.movies.map(m=>m.id),expected.rows.map(m=>m.tmdb_id));
    assert.deepEqual((await api(`/rooms/${code}`,'GET',guest.participant.token)).room.selection,started.room.selection);
    const repeated=await api(`/rooms/${code}/selection`,'POST',token,{revision:started.room.revision});
    assert.deepEqual(repeated.room.selection,started.room.selection);
    assert.equal((await api(`/rooms/${code}/filters`,'PUT',token,{filters,revision:0})).status,409);
    const empty=await api(`/rooms/${code}/filters`,'PUT',token,{filters:{yearFrom:1880,yearTo:1880},revision:started.room.revision});
    assert.equal(empty.room.selection,null);
    const emptyDeck=await api(`/rooms/${code}/selection`,'POST',token,{revision:empty.room.revision});
    assert.deepEqual(emptyDeck.room.selection.movies,[]);
    await pool.query("UPDATE rooms SET expires_at=now()-interval '1 second' WHERE code=$1",[code]);
    assert.equal((await api(`/rooms/${code}/selection`,'POST',token,{revision:emptyDeck.room.revision})).status,403);
  } finally {
    if (code) await pool.query('DELETE FROM rooms WHERE code=$1',[code]);
    await pool.end();
  }
});
