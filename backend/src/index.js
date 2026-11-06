import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { pool } from './db.js';
import { createRoom, getRoom, joinRoom, leaveRoom, RoomError, verifyMember } from './rooms.js';
import { normalizeCode, normalizeName, normalizeToken, readBearer } from './validation.js';
import { movieRouter } from './movieRoutes.js';
import { changeSelection } from './selection.js';
import { getVotingState, saveVote } from './voting.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use('/api/movies', movieRouter);

for (const [method, path, start] of [['put', 'filters', false], ['post', 'selection', true]]) {
  app[method](`/api/rooms/:code/${path}`, async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const token = readBearer(req.headers.authorization);
      if (!code || !token) return res.status(403).json({ error: 'Нет доступа к комнате' });
      const room = await changeSelection(code, token, req.body, start);
      io.to(channel(code)).emit('room:updated', room);
      res.json({ room });
    } catch (error) { next(error); }
  });
}

const server = http.createServer(app);
const io = new Server(server);
const channel = code => `room:${code}`;

app.get('/api/rooms/:code/voting', async (req,res,next) => {
  try {
    const code=normalizeCode(req.params.code), token=readBearer(req.headers.authorization);
    if(!code || !token) return res.status(403).json({error:'Нет доступа к комнате'});
    res.json(await getVotingState(code,token));
  } catch(error) { next(error); }
});
app.post('/api/rooms/:code/votes', async (req,res,next) => {
  try {
    const code=normalizeCode(req.params.code), token=readBearer(req.headers.authorization);
    if(!code || !token) return res.status(403).json({error:'Нет доступа к комнате'});
    const result=await saveVote(code,token,req.body);
    if(result.inserted) io.to(`session:${token}`).emit('votes:updated');
    if(result.match) io.to(channel(code)).emit('match:created',result.match);
    res.json(result);
  } catch(error) { next(error); }
});

const sendRoomUpdate = async code => {
  const room = await getRoom(code);
  io.to(channel(code)).emit('room:updated', room);
};

app.get('/api/health', async (_req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch (error) { next(error); }
});

app.post('/api/rooms', async (req, res, next) => {
  try {
    const name = normalizeName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Введите имя от 1 до 24 символов' });
    const result = await createRoom(name);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

app.post('/api/rooms/:code/join', async (req, res, next) => {
  try {
    const code = normalizeCode(req.params.code);
    const name = normalizeName(req.body?.name);
    if (!code || !name) return res.status(400).json({ error: 'Проверьте код комнаты и имя' });
    const result = await joinRoom(code, name);
    res.status(201).json(result);
    void sendRoomUpdate(code).catch(error => console.error('Update error:', error));
  } catch (error) { next(error); }
});

app.get('/api/rooms/:code', async (req, res, next) => {
  try {
    const code = normalizeCode(req.params.code);
    const token = readBearer(req.headers.authorization);
    if (!code || !await verifyMember(code, token)) return res.status(403).json({ error: 'Нет доступа к комнате' });
    const room = await getRoom(code);
    if (!room) return res.status(404).json({ error: 'Комната недоступна' });
    res.json({ room });
  } catch (error) { next(error); }
});

app.delete('/api/rooms/:code/me', async (req, res, next) => {
  try {
    const code = normalizeCode(req.params.code);
    const token = readBearer(req.headers.authorization);
    if (!code || !await verifyMember(code, token)) return res.status(403).json({ error: 'Нет доступа к комнате' });
    const room = await leaveRoom(code, token);
    io.in(`session:${token}`).disconnectSockets(true);
    res.json({ success: true });
    io.to(channel(code)).emit('room:updated', room);
  } catch (error) { next(error); }
});

io.use(async (socket, next) => {
  try {
    const code = normalizeCode(socket.handshake.auth?.code);
    const token = normalizeToken(socket.handshake.auth?.token);
    if (!code || !await verifyMember(code, token)) return next(new Error('Нет доступа к комнате'));
    socket.data.roomCode = code;
    socket.data.token = token;
    next();
  } catch (error) { next(error); }
});

io.on('connection', socket => {
  const code = socket.data.roomCode;
  socket.join(channel(code));
  socket.join(`session:${socket.data.token}`);
  void getRoom(code).then(async room => {
    if (!room || !await verifyMember(code, socket.data.token)) return socket.disconnect(true);
    if (!socket.connected) return;
    socket.emit('room:updated', room);
    const expiryTimer = setTimeout(() => {
      socket.emit('room:updated', null);
      socket.disconnect(true);
    }, Math.max(0, new Date(room.expiresAt).getTime() - Date.now()));
    socket.on('disconnect', () => clearTimeout(expiryTimer));
  })
    .catch(error => console.error('Socket room loading failed:', error));
});

app.use((error, _req, res, _next) => {
  if (error instanceof RoomError) return res.status(error.status).json({ error: error.message });
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Некорректный JSON' });
  console.error('API error:', error);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const port = Number(process.env.PORT || 3001);
server.listen(port, '0.0.0.0', () => console.log(`API ready at http://localhost:${port}`));

const shutdown = async () => { await new Promise(resolve => io.close(resolve)); await pool.end(); process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
