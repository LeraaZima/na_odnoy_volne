import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTmdbMovie, validateMovieFilters } from '../src/tmdbMapping.js';
import { createTmdbClient } from '../src/tmdbClient.js';

test('TMDB API Key передаётся отдельным параметром без Bearer', async () => {
  const tmdb = createTmdbClient({ apiKey: 'test-api-key', fetchImpl: async (url, options) => {
    assert.equal(url.searchParams.get('api_key'), 'test-api-key');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({ genres: [] });
  } });
  assert.deepEqual(await tmdb('/genre/movie/list'), { genres: [] });
});

test('TMDB movie details are normalized and original response kept', () => {
  const tmdb = { id: 123, title: 'Пример', original_title: 'Example', adult: false,
    release_date: '2020-10-11', runtime: 101, vote_average: 7.7, vote_count: 42,
    genres: [{ id: 18, name: 'Драма' }], production_companies: [{ id: 1, name: 'Studio' }],
    extra_future_field: { ok: true } };
  const m = normalizeTmdbMovie(tmdb);
  assert.equal(m.tmdbId, 123);
  assert.equal(m.runtime, 101);
  assert.deepEqual(m.genresForJoin, [{ id: 18, name: 'Драма' }]);
  assert.deepEqual(JSON.parse(m.raw).extra_future_field, { ok: true });
});

test('поиск и фильтры отклоняют массивы, пустые и некорректные значения', () => {
  assert.equal(validateMovieFilters({ q: '  Волна  ' }).q, 'Волна');
  for (const query of [{ limit: '' }, { offset: ' ' }, { min_rating: ['7'] }, { genre_id: '1.5' }, { q: ['a', 'b'] }, { q: 'a'.repeat(201) }]) {
    assert.throws(() => validateMovieFilters(query));
  }
});

test('TMDB: Bearer, язык, параметры и повтор после 429', async () => {
  let calls = 0;
  const delays = [];
  const tmdb = createTmdbClient({ token: 'test-only', sleep: async ms => delays.push(ms), fetchImpl: async (url, options) => {
    assert.equal(url.origin, 'https://api.themoviedb.org');
    assert.equal(url.searchParams.get('language'), 'ru-RU');
    assert.equal(url.searchParams.get('append_to_response'), 'videos,watch/providers');
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    return ++calls === 1 ? new Response('', { status: 429, headers: { 'retry-after': '2' } })
      : Response.json({ id: 1, title: 'Тест' });
  } });
  assert.equal((await tmdb('/movie/1', { append_to_response: 'videos,watch/providers' })).id, 1);
  assert.deepEqual(delays, [2000]);
});

test('TMDB: отсутствие токена, 401 и недоступная сеть', async () => {
  assert.throws(() => createTmdbClient({ token: '' }), /TMDB_ACCESS_TOKEN/);
  let calls = 0;
  const unauthorized = createTmdbClient({ token: 'test-only', fetchImpl: async () => { calls++; return new Response('', { status: 401 }); } });
  await assert.rejects(unauthorized('/movie/1'), /HTTP 401/);
  assert.equal(calls, 1);
  calls = 0;
  const offline = createTmdbClient({ token: 'test-only', sleep: async () => {}, fetchImpl: async () => { calls++; throw new Error('offline'); } });
  await assert.rejects(offline('/movie/1'), /ошибка сети/);
  assert.equal(calls, 3);
});
test('missing nullable TMDB attributes do not invent data', () => {
  const m = normalizeTmdbMovie({ id: 1, title: 'Test' });
  assert.equal(m.runtime, null);
  assert.equal(m.releaseDate, null);
  assert.equal(m.videos, 'null');
});
test('filters validate limits and years', () => {
  assert.deepEqual(validateMovieFilters({}), { genreId: null, yearFrom: null, yearTo: null, minRating: null, maxRuntime: null, limit: 20, offset: 0, q: null });
  assert.equal(validateMovieFilters({ year_from: '2020', year_to: '2023', min_rating: '7' }).minRating, 7);
  assert.throws(() => validateMovieFilters({ limit: '500' }));
  assert.throws(() => validateMovieFilters({ year_from: '2025', year_to: '2020' }));
});
