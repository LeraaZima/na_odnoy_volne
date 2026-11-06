import 'dotenv/config';
import { createTmdbClient } from '../src/tmdbClient.js';
// Local development importer. Uses the official TMDB API with a server-side Bearer token.
// Run after applying 002_tmdb_catalog.sql: docker compose exec backend npm run sync:tmdb
import { pool, withTransaction } from '../src/db.js';
import { saveTmdbMovie } from '../src/movieRepository.js';

const token = process.env.TMDB_ACCESS_TOKEN;
const apiKey = process.env.TMDB_API_KEY;
if (!token && !apiKey) {
  console.error('Задайте TMDB_ACCESS_TOKEN или TMDB_API_KEY в .env.');
  process.exitCode = 1;
} else {
  const language = process.env.TMDB_LANGUAGE || 'ru-RU';
  const pages = Number(process.env.TMDB_PAGES || 1);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let imported = 0;
  const tmdb = createTmdbClient({ token, apiKey, language });
  let failed = 0;
  try {
    if (!Number.isInteger(pages) || pages < 1 || pages > 3) throw new Error('TMDB_PAGES: целое число от 1 до 3');
    const { genres } = await tmdb('/genre/movie/list');
    if (!Array.isArray(genres)) throw new Error('Некорректный список жанров TMDB');
    await withTransaction(async client => {
      for (const genre of genres) {
        if (!Number.isSafeInteger(genre.id) || genre.id <= 0 || typeof genre.name !== 'string') throw new Error('Некорректный жанр TMDB');
        await client.query('INSERT INTO tmdb_genres(tmdb_id,name) VALUES($1,$2) ON CONFLICT(tmdb_id) DO UPDATE SET name=EXCLUDED.name', [genre.id, genre.name]);
      }
    });
    for (let page = 1; page <= pages; page++) {
      const { results } = await tmdb('/movie/popular', { page: String(page) });
      if (!Array.isArray(results)) throw new Error('Некорректный список фильмов TMDB');
      for (const item of results) {
        if (item.adult) continue;
        try {
          if (!Number.isSafeInteger(item.id) || item.id <= 0) throw new Error('Некорректный ID фильма');
          const details = await tmdb(`/movie/${item.id}`, { append_to_response: 'videos,watch/providers' });
          await saveTmdbMovie(details);
          imported++;
          process.stdout.write(`\rSaved ${imported} movies...`);

        } catch (error) {
          failed++;
          console.error(`\nUnable to import TMDB movie ${item.id}: ${error.message}`);
        }
        await sleep(170);
      }
    }
    if (failed || !imported) process.exitCode = 1;
    console.log(`\nFinished. Movies stored: ${imported}`);
  } catch (error) {
    console.error(`\nTMDB synchronization failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
