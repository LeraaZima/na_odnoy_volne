import { pool, withTransaction } from './db.js';
import { normalizeTmdbMovie } from './tmdbMapping.js';

const scalarColumns = [
  'tmdb_id','imdb_id','title','original_title','original_language','overview',
  'tagline','homepage','status','release_date','runtime','budget','revenue',
  'adult','video','popularity','vote_average','vote_count','poster_path',
  'backdrop_path','belongs_to_collection','genres','production_companies',
  'production_countries','spoken_languages','origin_country','videos',
  'watch_providers','raw_tmdb',
];

export async function saveTmdbMovie(rawMovie, transaction = withTransaction) {
  const m = normalizeTmdbMovie(rawMovie);
  const values = [
    m.tmdbId,m.imdbId,m.title,m.originalTitle,m.originalLanguage,m.overview,
    m.tagline,m.homepage,m.status,m.releaseDate,m.runtime,m.budget,m.revenue,
    m.adult,m.video,m.popularity,m.voteAverage,m.voteCount,m.posterPath,
    m.backdropPath,m.belongsToCollection,m.genres,m.productionCompanies,
    m.productionCountries,m.spokenLanguages,m.originCountry,m.videos,
    m.watchProviders,m.raw,
  ];
  const placeholders = scalarColumns.map((_, i) => `$${i + 1}`).join(', ');
  const updates = scalarColumns.filter(c => c !== 'tmdb_id')
    .map(c => `${c} = EXCLUDED.${c}`).join(', ');
  return transaction(async client => {
    await client.query(
      `INSERT INTO movies (${scalarColumns.join(', ')}) VALUES (${placeholders})
       ON CONFLICT (tmdb_id) DO UPDATE SET ${updates}, tmdb_synced_at = now()`, values
    );
    await client.query('DELETE FROM movie_genres WHERE movie_tmdb_id = $1', [m.tmdbId]);
    for (const g of m.genresForJoin) {
      await client.query('INSERT INTO tmdb_genres(tmdb_id, name) VALUES($1, $2) ON CONFLICT(tmdb_id) DO UPDATE SET name=EXCLUDED.name', [g.id,g.name]);
      await client.query('INSERT INTO movie_genres(movie_tmdb_id, genre_tmdb_id) VALUES($1, $2) ON CONFLICT DO NOTHING', [m.tmdbId,g.id]);
    }
    return m.tmdbId;
  });
}

// Public catalog endpoint. Return real data only; avoid returning full raw JSON in a list.
export async function listMovies(filters, db = pool) {
  const clauses = ['m.adult = false'];
  const values = [];
  const add = (value, fragment) => { values.push(value); clauses.push(fragment.replace('?', `$${values.length}`)); };
  if (filters.q) {
    values.push(`%${filters.q.replace(/[\\%_]/g, '\\$&')}%`);
    clauses.push(`(m.title ILIKE $${values.length} OR m.original_title ILIKE $${values.length})`);
  }
  if (filters.genreId !== null) add(filters.genreId, 'EXISTS (SELECT 1 FROM movie_genres mg WHERE mg.movie_tmdb_id = m.tmdb_id AND mg.genre_tmdb_id = ?)');
  if (filters.genreIds?.length) add(filters.genreIds, 'EXISTS (SELECT 1 FROM movie_genres mg WHERE mg.movie_tmdb_id=m.tmdb_id AND mg.genre_tmdb_id=ANY(?::int[]))');
  if (filters.yearFrom !== null) add(filters.yearFrom, 'EXTRACT(YEAR FROM m.release_date) >= ?');
  if (filters.yearTo !== null) add(filters.yearTo, 'EXTRACT(YEAR FROM m.release_date) <= ?');
  if (filters.minRating !== null) add(filters.minRating, 'm.vote_average >= ?');
  if (filters.maxRuntime !== null) add(filters.maxRuntime, 'm.runtime <= ?');
  values.push(filters.limit, filters.offset);
  const sql = `SELECT m.tmdb_id AS id, m.title, m.original_title, m.overview,
     m.release_date, m.runtime, m.vote_average, m.vote_count, m.popularity,
     m.poster_path, m.backdrop_path, m.original_language, m.genres
     FROM movies m WHERE ${clauses.join(' AND ')}
     ORDER BY m.popularity DESC NULLS LAST, m.tmdb_id
     LIMIT $${values.length-1} OFFSET $${values.length}`;
  const { rows } = await db.query(sql, values);
  return rows;
}

export async function getMovie(id, db = pool) {
  const { rows } = await db.query('SELECT * FROM movies WHERE tmdb_id = $1 AND adult = false', [id]);
  return rows[0] || null;
}
