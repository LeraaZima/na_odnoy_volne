export function createTmdbClient({ token, apiKey, language = 'ru-RU', fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!token?.trim() && !apiKey?.trim()) throw new Error('Задайте TMDB_ACCESS_TOKEN или TMDB_API_KEY в .env и пересоздайте backend');
  return async (path, params = {}) => {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set('language', language);
    if (!token?.trim()) url.searchParams.set('api_key', apiKey.trim());
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetchImpl(url, {
          headers: { ...(token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}), Accept: 'application/json' },
          signal: AbortSignal.timeout(12000),
        });
      } catch {
        if (attempt === 2) throw new Error('TMDB недоступен: ошибка сети или превышено время ожидания');
        await sleep(800 * (attempt + 1));
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const retry = response.headers.get('retry-after');
        const delay = retry === null ? 800 * (attempt + 1)
          : /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
        if (delay > 30000) throw new Error('TMDB просит повторить импорт позднее');
        await sleep(Number.isFinite(delay) ? Math.max(0, delay) : 1000);
        continue;
      }
      if (!response.ok) throw new Error(`Ошибка TMDB: HTTP ${response.status} (${url.pathname})`);
      return response.json();
    }
  };
}
