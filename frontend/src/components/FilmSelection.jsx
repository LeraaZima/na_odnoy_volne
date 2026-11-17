import { useEffect, useId, useState } from 'react';
import { request } from '../api.js';
import tmdbLogo from '../assets/tmdb-logo.svg';

export function TmdbCredit() {
  return <aside className="tmdb-credit" aria-label="Об источнике данных">
    <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img src={tmdbLogo} alt="TMDB" width="80" /></a>
    <div><strong>Источник фильмов и постеров — TMDB</strong><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></div>
  </aside>;
}

export function FilterScreen({ room, session, onRoom, onBack, onStart }) {
  const owner = room.ownerId === session.id;
  const [draft, setDraft] = useState(room.filters);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const savedFiltersKey = JSON.stringify(room.filters);
  useEffect(() => { setDraft(room.filters); }, [savedFiltersKey]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    request('/movies/genres').then(data => { if (active) setGenres(data.genres); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(room.filters);
  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  async function submit(event, start, newRound = false) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      let current = room;
      if (dirty) {
        current = (await request(`/rooms/${room.code}/filters`, { method: 'PUT', token: session.token, body: { filters: draft, revision: current.revision } })).room;
        onRoom(current);
      }
      if (start) {
        current = (await request(`/rooms/${room.code}/selection`, { method: 'POST', token: session.token, body: { revision: current.revision, newRound } })).room;
        onRoom(current);
        onStart();
      }
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        try { onRoom((await request(`/rooms/${room.code}`, { token: session.token })).room); } catch { /* Основная ошибка уже показана. */ }
      }
    } finally { setBusy(false); }
  }
  return <section className="selection-screen" aria-label="Настройка подборки">
    <button className="text-btn back-btn" onClick={onBack}>← Вернуться в комнату</button>
    <div className="selection-heading"><p className="eyebrow">02 / НАСТРАИВАЕМ ВЕЧЕР</p><h1>Какое кино <span className="text-gradient">сегодня?</span></h1><p className="description">Выберите рамки, а мы соберём общую колоду. Немного неожиданности — и только ваши жанры.</p></div>
    <div className="filter-layout">
      <form className="panel filter-panel" onSubmit={event => submit(event, true)}>
        {!owner && <p className="notice" role="status">{room.participants.some(p => p.id === room.ownerId) ? 'Подборку настраивает ведущий комнаты. Изменения появятся здесь автоматически.' : 'Ведущий вышел из комнаты. Готовую колоду можно смотреть; дождитесь обновления ведущего.'}</p>}
        {loading ? <p role="status">Загружаем жанры…</p> : <>
          {!genres.length && <button type="button" className="btn btn--secondary" onClick={() => setReload(n => n+1)}>Повторить загрузку жанров</button>}
          <fieldset disabled={!owner || busy}>
            <legend>Жанры</legend><p className="hint">Можно несколько. Подойдёт любой из выбранных; без выбора — все жанры.</p>
            <div className="genre-grid">{genres.map(genre => <label key={genre.id} className={`genre-chip ${draft.genreIds.includes(genre.id) ? 'is-selected' : ''}`}>
              <input type="checkbox" checked={draft.genreIds.includes(genre.id)} onChange={event => update('genreIds', event.target.checked ? [...draft.genreIds, genre.id].sort((a,b) => a-b) : draft.genreIds.filter(id => id !== genre.id))} />{genre.name}
            </label>)}</div>
            <div className="filter-fields">
              <label>Год от<input type="number" min="1880" max="2200" placeholder="Любой" value={draft.yearFrom ?? ''} onChange={e => update('yearFrom', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label>Год до<input type="number" min={draft.yearFrom ?? 1880} max="2200" placeholder="Любой" value={draft.yearTo ?? ''} onChange={e => update('yearTo', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label>Рейтинг от<input type="number" min="0" max="10" step="0.1" placeholder="Любой" value={draft.minRating ?? ''} onChange={e => update('minRating', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label>Длительность до, мин<input type="number" min="1" max="1000" placeholder="Без ограничения" value={draft.maxRuntime ?? ''} onChange={e => update('maxRuntime', e.target.value === '' ? null : Number(e.target.value))} /></label>
            </div>
          </fieldset>
          {owner && <div className="filter-actions">
            <button type="button" className="btn btn--secondary" disabled={busy || !dirty} onClick={event => submit(event, false)}>Сохранить настройки</button>
            {room.selection && <button type="button" className="btn btn--secondary" disabled={busy || room.participants.length<2} onClick={event=>submit(event,true,true)}>Новый раунд с текущим составом</button>}
            <button className="btn btn--primary" disabled={busy || room.participants.length<2}>{busy ? 'Собираем подборку…' : 'Начать выбор'} <span aria-hidden="true">→</span></button>
          </div>}
          <p className="hint">Для старта нужны минимум 2 участника. В раунд попадут все, кто уже вошёл в комнату, включая временно отключённых.</p>
          <p className="hint" role="status">{dirty ? 'Есть несохранённые изменения. «Начать выбор» также сохраняет их.' : 'Настройки сохранены и доступны всем участникам.'}</p>
        </>}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </form>
      <aside className="selection-note panel"><div className="orbit-mark" aria-hidden="true">≈</div><h2>Одна подборка.<br/>Разные взгляды.</h2><p>Одинаковые фильмы в одинаковом порядке — каждый смотрит в своём темпе.</p><p className="hint">Сохранение новых фильтров заменит текущую подборку для всех. Оценки относятся к текущей подборке; прошлые совпадения останутся в истории комнаты.</p></aside>
    </div><TmdbCredit />
  </section>;
}

export function FilmCard({ movie }) {
  const descriptionId = useId();
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return <article className="film-card" data-movie-id={movie.id}>
    <div className="film-poster">
      {movie.poster_path && !failed ? <img draggable={false} src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`Постер: ${movie.title}`} onError={() => setFailed(true)} /> : <div className="poster-placeholder" role="img" aria-label="Фирменная заглушка постера"><span>≈</span><p>Кино начинается<br/>с одной волны</p></div>}
    </div>
    <div className="film-info"><p className="eyebrow">ВАШ КИНОВЕЧЕР</p><h2>{movie.title}</h2>
      <div className="film-meta"><span>{movie.release_date?.slice(0,4) || 'Год неизвестен'}</span><span>★ {movie.vote_average == null ? 'Нет рейтинга' : Number(movie.vote_average).toFixed(1)}</span><span>{movie.runtime > 0 ? `${movie.runtime} мин` : 'Длительность неизвестна'}</span></div>
      <div className="film-genres">{movie.genres?.length ? movie.genres.map(g => <span key={g.id}>{g.name}</span>) : <span>Жанры не указаны</span>}</div>
      <button className="btn btn--secondary" aria-expanded={expanded} aria-controls={descriptionId} onClick={() => setExpanded(v => !v)}>{expanded ? 'Скрыть описание' : 'Подробнее о фильме'}</button>
      {expanded && <p className="film-description" id={descriptionId}>{movie.overview?.trim() || 'Описание пока недоступно'}</p>}
    </div>
  </article>;
}
