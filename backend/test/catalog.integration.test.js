import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMovieFilters } from '../src/tmdbMapping.js';

test('каталог: JSONB, повторный импорт, поиск, фильтры, связи жанров и rollback', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  const { pool } = await import('../src/db.js');
  const { saveTmdbMovie, listMovies, getMovie } = await import('../src/movieRepository.js');
  const client = await pool.connect();
  // Тестовые данные остаются внутри транзакции и никогда не публикуются в каталоге.
  const id = 9000000000001;
  const genre = 99991;
  const query = q => listMovies(validateMovieFilters(q), client);
  try {
    await client.query('BEGIN');
    const original = { id, title: 'Тест Волна 100%', original_title: 'Wave Test', release_date: '2020-01-02',
      runtime: 95, vote_average: 8, genres: [{ id: genre, name: 'Тестовый жанр' }], extra: { retained: true } };
    await saveTmdbMovie(original, work => work(client));
    assert.deepEqual((await getMovie(id, client)).raw_tmdb, original);
    assert.equal((await query({ q: 'волна 100%', genre_id: String(genre), year_from: '2019', year_to: '2021', min_rating: '7', max_runtime: '100' })).length, 1);
    assert.equal((await query({ q: 'Wave Test', genre_id: String(genre), max_runtime: '90' })).length, 0);
    assert.equal((await query({ q: "' OR true --", genre_id: String(genre) })).length, 0);
    await saveTmdbMovie({ ...original, title: 'Обновлено', genres: [] }, work => work(client));
    assert.equal((await getMovie(id, client)).title, 'Обновлено');
    assert.equal((await client.query('SELECT * FROM movie_genres WHERE movie_tmdb_id=$1', [id])).rowCount, 0);
    assert.equal((await client.query('SELECT * FROM movies WHERE tmdb_id=$1', [id])).rowCount, 1);
    await saveTmdbMovie({ ...original, adult: true }, work => work(client));
    assert.equal(await getMovie(id, client), null);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
