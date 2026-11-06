// Keep all TMDB fields in raw_tmdb, normalize known movie details for SQL filtering.
// TMDB discover/popular list results do NOT include runtime/production info;
// importing movie/{id} detail is required to populate these fields.
const finiteNumber = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const text = value => typeof value === 'string' ? value : null;
const array = value => Array.isArray(value) ? value : [];
const json = value => JSON.stringify(value ?? null);

export function normalizeTmdbMovie(movie) {
  if (!movie || !Number.isSafeInteger(movie.id) || movie.id <= 0 || typeof movie.title !== 'string' || !movie.title.trim()) {
    throw new Error('TMDB returned invalid movie details');
  }
  const date = typeof movie.release_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(movie.release_date)
    ? movie.release_date : null;
  const genres = array(movie.genres).filter(g => Number.isSafeInteger(g?.id) && typeof g.name === 'string');
  return {
    tmdbId: movie.id,
    imdbId: text(movie.imdb_id),
    title: movie.title,
    originalTitle: text(movie.original_title),
    originalLanguage: text(movie.original_language),
    overview: text(movie.overview),
    tagline: text(movie.tagline),
    homepage: text(movie.homepage),
    status: text(movie.status),
    releaseDate: date,
    runtime: integer(movie.runtime),
    budget: integer(movie.budget),
    revenue: integer(movie.revenue),
    adult: movie.adult === true,
    video: movie.video === true,
    popularity: finiteNumber(movie.popularity),
    voteAverage: finiteNumber(movie.vote_average),
    voteCount: integer(movie.vote_count),
    posterPath: text(movie.poster_path),
    backdropPath: text(movie.backdrop_path),
    belongsToCollection: json(movie.belongs_to_collection),
    genres: json(genres),
    productionCompanies: json(array(movie.production_companies)),
    productionCountries: json(array(movie.production_countries)),
    spokenLanguages: json(array(movie.spoken_languages)),
    originCountry: json(array(movie.origin_country)),
    videos: json(movie.videos),
    watchProviders: json(movie['watch/providers']),
    raw: JSON.stringify(movie),
    genresForJoin: genres,
  };
}

export function validateMovieFilters(query = {}) {
  const num = (value, min, max) => {
    if (value === undefined) return null;
    if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) return NaN;
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
  };
  const filters = {
    genreId: num(query.genre_id, 1, 99999),
    yearFrom: num(query.year_from, 1880, 2200),
    yearTo: num(query.year_to, 1880, 2200),
    minRating: num(query.min_rating, 0, 10),
    maxRuntime: num(query.max_runtime, 1, 1000),
    limit: query.limit === undefined ? 20 : num(query.limit, 1, 50),
    offset: query.offset === undefined ? 0 : num(query.offset, 0, 10000),
  };
  if (Object.values(filters).some(v => Number.isNaN(v)) ||
      filters.yearFrom !== null && !Number.isInteger(filters.yearFrom) ||
      filters.yearTo !== null && !Number.isInteger(filters.yearTo) ||
      filters.yearFrom !== null && filters.yearTo !== null && filters.yearFrom > filters.yearTo ||
      !Number.isInteger(filters.genreId ?? 1) ||
      !Number.isInteger(filters.limit) || !Number.isInteger(filters.offset)) {
    throw new Error('Некорректные параметры фильтрации');
  }
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.trim().length > 200)) {
    throw new Error('Некорректный поисковый запрос');
  }
  filters.q = query.q?.trim() || null;
  return filters;
}
