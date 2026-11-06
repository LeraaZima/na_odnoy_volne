import { Router } from 'express';
import { getMovie, listMovies } from './movieRepository.js';
import { validateMovieFilters } from './tmdbMapping.js';
import { pool } from './db.js';

export const movieRouter = Router();
movieRouter.get('/genres', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT tmdb_id AS id, name FROM tmdb_genres ORDER BY name, tmdb_id');
    res.json({ genres: rows });
  } catch (error) { next(error); }
});
movieRouter.get('/', async (req, res, next) => {
  try {
    let filters;
    try { filters = validateMovieFilters(req.query); }
    catch { return res.status(400).json({ error: 'Некорректные параметры фильтрации' }); }
    const movies = await listMovies(filters);
    res.json({ movies, count: movies.length, limit: filters.limit, offset: filters.offset });
  } catch (error) { next(error); }
});
movieRouter.get('/:tmdbId', async (req, res, next) => {
  try {
    if (!/^[1-9]\d{0,14}$/.test(req.params.tmdbId)) return res.status(400).json({ error: 'Неверный id фильма' });
    const movie = await getMovie(req.params.tmdbId);
    if (!movie) return res.status(404).json({ error: 'Фильм не найден в локальной базе' });
    res.json({ movie });
  } catch (error) { next(error); }
});
