import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

// Запуск внутри frontend-контейнера: запросы проходят через прокси Vite.
const base = process.env.TEST_BASE_URL || 'http://localhost:5173';
const sockets = [];
const sessions = [];
async function api(path, method = 'GET', body, token) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Нет события ${name}`)); }, 8000);
    function listener(value) {
      if (!predicate(value)) return;
      clearTimeout(timer); socket.off(name, listener); resolve(value);
    }
    socket.on(name, listener);
  });
}
function connect(code, token, transports = ['polling', 'websocket']) {
  const socket = io(base, { auth: { code, token }, transports, autoConnect: false, reconnection: false });
  sockets.push(socket);
  return socket;
}
try {
  assert.equal((await api('/health')).status, 200);
  assert.equal((await api('/rooms', 'POST', { name: ' ' })).status, 400);
  const created = await api('/rooms', 'POST', { name: 'Проверка Лера' });
  assert.equal(created.status, 201);
  const { code, expiresAt } = created.data.room;
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.ok(Math.abs(new Date(expiresAt) - Date.now() - 86400000) < 60000);
  const first = created.data.participant;
  sessions.push({ code, token: first.token });
  const a = connect(code, first.token, ['polling']);
  let update = event(a, 'room:updated', room => room?.participants.length === 1);
  a.connect(); await update;
  update = event(a, 'room:updated', room => room?.participants.length === 2);
  const attempts = await Promise.all(['Антон'].map(name => api(`/rooms/${code}/join`, 'POST', { name })));
  assert.deepEqual(attempts.map(r => r.status).sort(), [201]);
  const second = attempts.find(r => r.status === 201).data.participant;
  sessions.push({ code, token: second.token });
  await update;
  const b = connect(code, second.token, ['websocket']);
  update = event(b, 'room:updated', room => room?.participants.length === 2);
  b.connect(); await update;
  assert.equal((await api(`/rooms/${code}`, 'GET', null, first.token)).data.room.participants.length, 2);
  a.disconnect();
  update = event(a, 'room:updated', room => room?.participants.length === 2);
  a.connect(); await update;
  assert.equal((await api(`/rooms/${code}`, 'GET', null, '-'.repeat(36))).status, 403);
  const invalid = connect(code, { invalid: true });
  const rejected = event(invalid, 'connect_error');
  invalid.connect(); assert.match((await rejected).message, /Нет доступа/);
  const filters = { genreIds: [], yearFrom: 1900, yearTo: 2200, minRating: 5, maxRuntime: 180 };
  const revision=(await api(`/rooms/${code}`,'GET',null,first.token)).data.room.revision;
  const filtersEvent = event(b, 'room:updated', room => room?.revision === revision+1);
  assert.equal((await api(`/rooms/${code}/filters`, 'PUT', { filters, revision }, second.token)).status, 403);
  assert.equal((await api(`/rooms/${code}/filters`, 'PUT', { filters, revision }, first.token)).status, 200);
  assert.deepEqual((await filtersEvent).filters, filters);
  const deckA = event(a, 'room:updated', room => !!room?.selection);
  const deckB = event(b, 'room:updated', room => !!room?.selection);
  const started = await api(`/rooms/${code}/selection`, 'POST', { revision: revision+1 }, first.token);
  assert.equal(started.status, 200);
  const [stateA, stateB] = await Promise.all([deckA, deckB]);
  assert.deepEqual(stateA.selection, stateB.selection);
  a.disconnect();
  const restored = event(a, 'room:updated', room => !!room?.selection);
  a.connect();
  assert.deepEqual((await restored).selection, stateA.selection);
  assert.deepEqual((await api(`/rooms/${code}`, 'GET', null, second.token)).data.room.selection, stateA.selection);
  console.log('OK: права создателя, синхронизация фильтров, одинаковая колода и восстановление порядка.');
  const selection = stateA.selection;
  assert.ok(selection.movies.length >= 2, 'Импортируйте каталог TMDB');
  const vote = (token, index) => api(`/rooms/${code}/votes`, 'POST', { selectionId: selection.id, movieId: selection.movies[index].id, choice: 'like' }, token);
  const matchA = event(a, 'match:created');
  const matchB = event(b, 'match:created');
  const simultaneous = await Promise.all([vote(first.token,0),vote(second.token,0)]);
  assert.ok(simultaneous.every(r=>r.status===200));
  const [notificationA,notificationB] = await Promise.all([matchA,matchB]);
  assert.equal(notificationA.id,notificationB.id);
  assert.equal((await vote(first.token,0)).data.inserted,false);
  assert.equal((await api(`/rooms/${code}/voting`, 'GET',null,first.token)).data.matches.length,1);
  b.disconnect();
  await vote(first.token,1);
  const offlineMatch = event(a,'match:created',match=>match.id!==notificationA.id);
  await vote(second.token,1);
  await offlineMatch;
  const reconnected = event(b,'room:updated');
  b.connect(); await reconnected;
  const recovered = (await api(`/rooms/${code}/voting`,'GET',null,second.token)).data;
  assert.equal(recovered.matches.length,2);
  assert.equal(recovered.votes.length,2);
  assert.equal(new Set(recovered.matches.map(m=>m.id)).size,2);
  console.log('OK: одновременные лайки, Match обоим сокетам, повтор без дублей, история и прогресс после переподключения.');
  update = event(a, 'room:updated', room => room?.participants.length === 1);
  const disconnected = event(b, 'disconnect');
  assert.equal((await api(`/rooms/${code}/me`, 'DELETE', null, second.token)).status, 200);
  await Promise.all([update, disconnected]);
  assert.equal((await api(`/rooms/${code}`, 'GET', null, second.token)).status, 403);
  const denied = event(b, 'connect_error');
  b.connect(); assert.match((await denied).message, /Нет доступа/);
  console.log('OK: создание, срок 24 ч, вход двух участников, HTTP, polling, WebSocket, переподключение, неверные токены, выход и отзыв доступа.');
} finally {
  sockets.forEach(socket => socket.disconnect());
  for (const session of sessions) await api(`/rooms/${session.code}/me`, 'DELETE', null, session.token);
}
