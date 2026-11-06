import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { request } from './api.js';
import { GlowInput } from './components/GlowInput.jsx';
import { FilterScreen } from './components/FilmSelection.jsx';
import { useVoting } from './useVoting.js';
import { SwipeDeck, Matches, MatchScreen } from './components/Voting.jsx';
import waveMascot from './assets/wave_mascot_v3.png';

const STORAGE_KEY = 'wave:mvp:room:v1';
const initialCode = new URLSearchParams(location.search).get('room')?.toUpperCase() || '';

function WaveArt() {
  return <img className="wave-art wave-art--mascot" src={waveMascot}
    width="1220" height="768" alt="Фиолетово-голубая волна с улыбкой и большим завитком" />;
}

function Brand() {
  return <span className="brand"><span className="brand__mark">≈</span><span>на одной <b>волне</b></span></span>;
}

function Icon({ name, size = 20 }) {
  const paths = {
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></>,
    moon: <path d="M20.5 14.2A9 9 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z"/>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><path d="M17 5a3 3 0 0 1 0 6m0 3a5 5 0 0 1 4 5v1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    exit: <><path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"/></>,
    film: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18m10-18v18M3 8h4m-4 8h4m10-8h4m-4 8h4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('wave:theme') || 'dark');
  const [name, setName] = useState(() => localStorage.getItem('wave:name') || '');
  const [code, setCode] = useState(initialCode);
  const [session, setSession] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } });
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState('room');
  const [voteRefresh,setVoteRefresh]=useState(0);
  const [matchQueue,setMatchQueue]=useState([]);
  const seenMatches=useRef(new Set());
  const voting=useVoting(session,room?.selection?.id,voteRefresh);
  function notifyMatch(match) {
    if(seenMatches.current.has(match.id)) return;
    seenMatches.current.add(match.id);
    setMatchQueue(queue=>[...queue,match]);
  }
  useEffect(()=>{setMatchQueue([]);seenMatches.current.clear();},[session?.token]);
  const acceptRoom = updated => setRoom(current => !updated || !current || updated.code !== current.code || updated.revision >= current.revision ? updated : current);
  useEffect(() => { if (!session) { setView('room'); setRoom(null); } }, [session?.code]);
  useEffect(() => {
    if (room?.selection) setView('deck');
    else setView(current => current === 'deck' ? 'filters' : current);
  }, [room?.selection?.id]);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('wave:theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('wave:name', name); }, [name]);
  useEffect(() => { if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); else localStorage.removeItem(STORAGE_KEY); }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let receivedUpdate = false;
    const refreshRoom = () => request(`/rooms/${session.code}`, { token: session.token })
      .then(result => { if (active && !receivedUpdate) acceptRoom(result.room); })
      .catch(err => { if (active) {
        setError(err.message);
        if (err.status === 403 || err.status === 404) { setSession(null); setRoom(null); }
      } });
    void refreshRoom();
    window.addEventListener('online', refreshRoom);
    const socket = io({ auth: { code: session.code, token: session.token } });
    socket.on('room:updated', updated => {
      if (!active) return;
      receivedUpdate = true;
      acceptRoom(updated);
      if (!updated) { setSession(null); setError('Срок действия комнаты истёк. Создай новую комнату.'); }
    });
    socket.on('connect', () => { if (active) { setError(''); setVoteRefresh(n=>n+1); } });
    socket.on('votes:updated',()=>{if(active)setVoteRefresh(n=>n+1);});
    socket.on('match:created',match=>{if(active){notifyMatch(match);setVoteRefresh(n=>n+1);}});
    socket.on('disconnect', reason => {
      if (active && reason === 'io server disconnect') { setSession(null); setRoom(null); }
      else if (active) setError('Связь прервалась. Восстанавливаем подключение; сохранённые оценки не потеряются.');
    });
    socket.on('connect_error', err => {
      if (!active) return;
      setError(`Связь с комнатой: ${err.message}`);
      // Отказ Socket.IO в доступе не запускает новые попытки подключения.
      // HTTP отличает истёкшую/отозванную сессию от временного сбоя сети.
      void refreshRoom();
    });
    return () => { active = false; window.removeEventListener('online', refreshRoom); socket.disconnect(); };
  }, [session?.code, session?.token]);

  async function handleCreate(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const result = await request('/rooms', { method: 'POST', body: { name } }); acceptRoom(result.room); setSession({ code: result.room.code, token: result.participant.token, name: result.participant.name, id: result.participant.id }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function handleJoin(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const result = await request(`/rooms/${code.trim().toUpperCase()}/join`, { method: 'POST', body: { name } }); acceptRoom(result.room); setSession({ code: result.room.code, token: result.participant.token, name: result.participant.name, id: result.participant.id }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function handleLeave() {
    if (!session) return;
    setBusy(true); setError('');
    try { await request(`/rooms/${session.code}/me`, { method: 'DELETE', token: session.token }); setSession(null); setRoom(null); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function copyInvite() {
    if (!session) return;
    const text = `${window.location.origin}/?room=${session.code}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('Не удалось скопировать ссылку автоматически. Отправь другу код комнаты.'); }
  }

  return (
    <div className="app-shell">
      <header className="topbar container">
        <Brand />
        <div className="topbar__right">
          <span className="version">MVP · кино вдвоём</span>
          {session && <button className="btn btn--secondary matches-nav" aria-label="Открыть совпадения" onClick={()=>setView('matches')}>♡ {voting.state?.matches.length ?? '…'}</button>}
          <button className="icon-btn" onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} aria-label="Переключить тему" title="Сменить тему"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        </div>
      </header>

      <main className="container main">
        {session && room && view === 'matches' ? <Matches voting={voting} onBack={()=>setView('room')} onDeck={()=>setView(room.selection ? 'deck' : 'filters')} />
          : session && room && view === 'filters' ? <FilterScreen room={room} session={session} onStart={() => setView('deck')} onRoom={acceptRoom} onBack={() => setView('room')} />
          : session && room?.selection && view === 'deck' ? <SwipeDeck key={room.selection.id} room={room} voting={voting} onMatch={notifyMatch} onBack={() => setView('room')} onFilters={() => setView('filters')} onMatches={()=>setView('matches')} />
          : session ? (
          <section className="room-layout" aria-label="Комната">
            <div className="room-panel panel">
              <p className="eyebrow"><span className="pulse-dot"/> КОМНАТА СОЗДАНА</p>
              <h1>Вы уже <span className="text-gradient">на одной волне</span></h1>
              <p className="description">Пригласи друга. Когда он присоединится, вы сможете выбирать кино вместе.</p>
              <div className="invite-box">
                <p className="muted-label">КОД ПРИГЛАШЕНИЯ</p>
                <div className="invite-box__code">{session.code}</div>
                <button className="btn btn--secondary" onClick={copyInvite}><Icon name={copied ? 'check' : 'link'}/>{copied ? 'Ссылка скопирована' : 'Скопировать приглашение'}</button>
              </div>
              <div className="member-section">
                <div className="section-head"><h2>Участники</h2><span className="pill">{room?.participants?.length ?? '…'} / 2</span></div>
                <div className="member-list">
                  {room?.participants?.map((p, index) => <div className="member" key={p.id}><span className={`avatar avatar--${index+1}`}>{p.name.charAt(0).toUpperCase()}</span><span>{p.name}{p.id === session.id && <small> · это ты</small>}</span><Icon name="check" size={18}/></div>)}
                  {(room?.participants?.length || 0) < 2 && <div className="member member--waiting"><span className="avatar avatar--empty">+</span><span>Ждём второго участника…</span><span className="spinner"/></div>}
                </div>
              </div>
              <button className="btn btn--primary btn--wide" disabled={!room} onClick={() => setView(room.selection ? 'deck' : 'filters')}>{room ? (room.selection ? 'Открыть колоду' : 'К выбору фильмов') : 'Загружаем комнату…'} <Icon name="arrow"/></button>
              {room?.selection && <button className="text-btn" onClick={() => setView('filters')}>Настройки подборки</button>}
              <p className="hint">{room?.ownerId === session.id ? 'Ты создатель комнаты — настрой общую подборку.' : 'Создатель настраивает подборку; вы увидите одинаковые фильмы.'}</p>
              <button className="text-btn" disabled={busy} onClick={handleLeave}><Icon name="exit" size={17}/> Покинуть комнату</button>
            </div>
            <div className="side-panel"><WaveArt/><div className="side-panel__label"><span>01</span> СОЗДАЁМ ОБЩУЮ ВОЛНУ</div></div>
          </section>
        ) : (
          <section className="hero-layout">
            <div className="hero-content">
              <div className="eyebrow"><span className="pulse-dot"/> ФИЛЬМ НА ВЕЧЕР? НАЙДЁТСЯ.</div>
              <h1>Ваш вечер.<br/><span className="text-gradient">Одна волна.</span></h1>
              <p className="description">Не спорьте, что смотреть. Соберите друзей в одной комнате — и находите фильмы, которые нравятся вам обоим.</p>
              <div className="form-panel panel">
                <label className="field-label" htmlFor="name">Как тебя зовут?</label>
                <GlowInput id="name" value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Например, Лера" autoComplete="nickname" />
                <form onSubmit={handleCreate}><button className="btn btn--primary btn--wide" disabled={busy || !name.trim()}><Icon name="users"/> Создать комнату <Icon name="arrow"/></button></form>
                <div className="form-divider"><span>или присоединиться</span></div>
                <form onSubmit={handleJoin} className="join-form">
                  <GlowInput aria-label="Код комнаты" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,6))} placeholder="КОД КОМНАТЫ" maxLength={6} className="code-input" />
                  <button className="btn btn--secondary" disabled={busy || !name.trim() || code.length !== 6}>Войти <Icon name="arrow"/></button>
                </form>
                <p className="hint">Без регистрации. Комната действует 24 часа.</p>
              </div>
            </div>
            <div className="hero-visual"><WaveArt/><div className="floating-note floating-note--one"><Icon name="film"/> Найдём кино?</div><div className="floating-note floating-note--two">✦ Вместе интереснее</div></div>
          </section>
        )}
        {error && <div className="error-message" role="alert">{error}<button onClick={() => setError('')} aria-label="Закрыть сообщение">×</button></div>}
      </main>
      {session && matchQueue[0] && <MatchScreen key={matchQueue[0].id} match={matchQueue[0]} onContinue={()=>setMatchQueue(queue=>queue.slice(1))}/>}
      <footer className="footer container"><span>© На одной волне</span><span>Создаём вместе · 2 frontend + 2 backend</span></footer>
    </div>
  );
}

export default App;
