import { useEffect, useRef, useState } from 'react';
import { FilmCard, TmdbCredit } from './FilmSelection.jsx';
import mascot from '../assets/wave_mascot_v3.png';

function LoadState({voting}) {
  return voting.error ? <div className="inline-error" role="alert">{voting.error}<button className="btn btn--secondary" onClick={voting.reload}>Повторить загрузку</button></div> : <p role="status">Восстанавливаем ваши оценки…</p>;
}

export function SwipeDeck({room,voting,onBack,onFilters,onMatches,onMatch}) {
  const [movement,setMovement]=useState(0);
  const [pending,setPending]=useState(null);
  const [error,setError]=useState('');
  const drag=useRef(null), sending=useRef(false), alive=useRef(true), zone=useRef(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const movies=room.selection.movies;
  const rated=new Set(voting.state?.votes.map(v=>v.movieId) || []);
  const next=movies.find(m=>!rated.has(String(m.id)));
  const movie=pending?.movie || next;
  async function cast(choice) {
    if(sending.current || !movie || !voting.state) return;
    sending.current=true;setError('');setMovement(0);
    setPending({movie,choice,phase:'saving'});
    try {
      const result=await voting.vote(movie.id,choice);
      if(alive.current && result.match) onMatch(result.match);
      if(!alive.current) return;
      setPending({movie,choice,phase:'leaving'});
      await new Promise(resolve=>setTimeout(resolve,window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260));
    } catch(err) {if(alive.current) setError(err.message);}
    finally {if(alive.current){setPending(null);sending.current=false;}}
  }
  const reset=()=>{drag.current=null;setMovement(0);};
  function pointerDown(event) {
    if(sending.current || !event.isPrimary || event.button!==0 || event.target.closest('button,a,input,textarea,.film-description')) return;
    drag.current={id:event.pointerId,x:event.clientX,y:event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
    zone.current?.focus({preventScroll:true});
  }
  function pointerMove(event) {
    if(drag.current?.id===event.pointerId) setMovement(event.clientX-drag.current.x);
  }
  function pointerUp(event) {
    if(drag.current?.id!==event.pointerId) return;
    const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;
    reset();
    if(Math.abs(dx)>=85 && Math.abs(dx)>Math.abs(dy)*1.3) void cast(dx>0?'like':'dislike');
  }
  return <section className="selection-screen" aria-label="Колода фильмов">
    <div className="selection-nav"><button className="text-btn back-btn" onClick={onBack}>← Вернуться в комнату</button><button className="btn btn--secondary" onClick={onMatches}>Совпадения · {voting.state?.matches.length ?? '…'}</button></div>
    <div className="selection-heading"><p className="eyebrow">03 / ДОВЕРЬТЕСЬ ОЩУЩЕНИЮ</p><h1>Ваше кино. <span className="text-gradient">Ваша волна.</span></h1><p className="description">Вправо — нравится, влево — пропустить. Выбирайте в своём темпе: мы найдём то, что объединяет.</p></div>
    {!voting.state ? <LoadState voting={voting}/> : movie ? <>
      <p className="deck-progress" role="status">Оценено {rated.size} из {movies.length}{pending?.phase==='saving' ? ' · Сохраняем оценку…' : ''}</p>
      <div className="swipe-zone" ref={zone} tabIndex="0" aria-label="Оценка фильма: стрелка вправо — нравится, влево — пропустить" aria-describedby="swipe-help" onKeyDown={event=>{
        if(event.repeat || event.target.closest('button,a,input,textarea') || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
        event.preventDefault();void cast(event.key==='ArrowRight'?'like':'dislike');
      }}>
        <div className="deck-stack"><div className={`swipe-card ${pending?.phase==='leaving' ? `swipe-leave swipe-leave--${pending.choice}` : ''} ${movement ? 'is-dragging' : ''}`} style={{'--drag-x':`${movement}px`,'--drag-angle':`${Math.max(-16,Math.min(16,movement/20))}deg`}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={reset} onLostPointerCapture={reset}>
          <FilmCard key={movie.id} movie={movie}/>
          <span className={`swipe-label ${movement>0?'swipe-label--like':'swipe-label--dislike'}`} style={{opacity:Math.min(1,Math.abs(movement)/85)}} aria-hidden="true">{movement>0?'Нравится':'Пропустить'}</span>
        </div></div>
      </div>
      <div className="deck-controls"><button className="vote-button vote-button--dislike" disabled={!!pending} onClick={()=>cast('dislike')}><span aria-hidden="true">×</span>Пропустить</button><button className="vote-button vote-button--like" disabled={!!pending} onClick={()=>cast('like')}><span aria-hidden="true">♡</span>Нравится</button></div>
      <p className="hint swipe-help" id="swipe-help">Перетащите карточку или используйте кнопки. На клавиатуре: Tab до колоды, затем ← / →.</p>
    </> : <div className="panel empty-deck"><span aria-hidden="true">≈</span><h2>{movies.length?'Вы посмотрели всю подборку':'На этой волне пока тихо'}</h2><p>{movies.length?'Ваши оценки сохранены. Другой участник может продолжать — новые совпадения появятся автоматически.':'Подходящих фильмов нет. Попробуйте изменить фильтры.'}</p><button className="btn btn--primary" onClick={onMatches}>Посмотреть совпадения</button></div>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {voting.state && voting.error && <LoadState voting={voting}/>}
    <button className="text-btn" onClick={onFilters}>Вернуться к фильтрам</button><TmdbCredit/>
  </section>;
}

export function MatchScreen({match,onContinue}) {
  const dialog=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    dialog.current.showModal();
    return()=>{dialog.current?.close();if(previous?.isConnected) previous.focus();else document.querySelector('.swipe-zone')?.focus();};
  },[]);
  return <dialog className="match-screen" ref={dialog} aria-labelledby="match-heading" onCancel={event=>{event.preventDefault();onContinue();}} onKeyDown={event=>{
    if(event.key==='Tab') {event.preventDefault();event.currentTarget.querySelector('button')?.focus();}
  }}>
    <div className="match-waves" aria-hidden="true"/>
    <div className="match-particles" aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i} style={{'--particle':i}}/>)}</div>
    <div className="match-content"><p className="eyebrow">ВАШ ВЫБОР СОВПАЛ</p><h1 id="match-heading">Вы на одной <span className="text-gradient">волне!</span></h1>
      <div className="match-visual"><div className="match-poster"><MovieThumb movie={match.movie}/></div><img className="match-mascot" src={mascot} alt="Фирменная волна"/></div>
      <h2>{match.movie.title}</h2><p>Этот фильм понравился вам обоим. Вечер становится ближе.</p>
      <button autoFocus className="btn btn--primary" onClick={onContinue}>Продолжить выбор</button>
    </div>
  </dialog>;
}

function MovieThumb({movie}) {
  const [failed,setFailed]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const placeholder=<div className="poster-placeholder" role="img" aria-label="Фирменная заглушка постера"><span>≈</span></div>;
  return movie.poster_path && !failed ? <div className="thumb-media">{!loaded && placeholder}<img src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} alt={`Постер: ${movie.title}`} style={{opacity:loaded?1:0}} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/></div> : placeholder;
}

export function Matches({voting,onBack,onDeck}) {
  return <section className="selection-screen" aria-label="Совпадения">
    <div className="selection-nav"><button className="text-btn back-btn" onClick={onBack}>← Вернуться в комнату</button><button className="btn btn--secondary" onClick={onDeck}>Продолжить выбор</button></div>
    <div className="selection-heading"><p className="eyebrow">ВАШ ОБЩИЙ СПИСОК</p><h1>То, что <span className="text-gradient">объединяет</span></h1><p className="description">Совпадения всех подборок этой комнаты — до конца её срока действия.</p></div>
    {!voting.state ? <LoadState voting={voting}/> : voting.state.matches.length ? <div className="matches-list">{voting.state.matches.map(match=><details key={match.id} className="panel match-item" data-match-id={match.id}>
      <summary><div className="match-thumbnail"><MovieThumb movie={match.movie}/></div><div><h2>{match.movie.title}</h2><p>{match.movie.release_date?.slice(0,4) || 'Год неизвестен'} · ★ {match.movie.vote_average==null?'—':Number(match.movie.vote_average).toFixed(1)}</p><p>{match.movie.genres?.map(g=>g.name).join(' · ')}</p><small>{match.participants.map(p=>p.name).join(' + ')} · Подробнее ↓</small></div></summary>
      <FilmCard movie={match.movie}/>
    </details>)}</div> : <div className="panel empty-deck"><span aria-hidden="true">♡</span><h2>Совпадения ещё впереди</h2><p>Когда оба поставят лайк одному фильму, он появится здесь.</p></div>}
    {voting.state && voting.error && <LoadState voting={voting}/>}<TmdbCredit/>
  </section>;
}
