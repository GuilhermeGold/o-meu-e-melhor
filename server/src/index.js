import cors from 'cors';
import express from 'express';
import { existsSync } from 'fs';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import { CONFIG } from './config.js';
import { MatchmakingQueue } from './MatchmakingQueue.js';
import { RoomManager } from './RoomManager.js';

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true }));

// Em produção o build do client (client/dist) é servido pelo próprio
// servidor, então frontend e backend ficam atrás de uma única URL/porta —
// não precisa de dois serviços nem de configurar CORS entre eles. Em dev
// isso é ignorado (o Vite serve o client separadamente na porta 5173).
const clientDist = join(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const roomManager = new RoomManager(io);
const matchmaking = new MatchmakingQueue(io, roomManager);

function sanitizeName(name) {
  return (name || '').toString().trim().slice(0, CONFIG.MAX_NAME_LENGTH);
}

function sanitizeCategory(category) {
  return CONFIG.CATEGORIES.includes(category) ? category : CONFIG.DEFAULT_CATEGORY;
}

io.on('connection', (socket) => {
  socket.data.roomCode = null;
  socket.data.playerName = null;

  socket.on('create_room', ({ playerName, category } = {}) => {
    const name = sanitizeName(playerName);
    if (!name) return socket.emit('error', { message: 'Nome inválido.' });
    const cat = sanitizeCategory(category);

    const room = roomManager.createRoom(cat);
    room.addPlayer({ id: socket.id, name, score: 0, eliminated: false, connected: true });
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = name;

    socket.emit('room_created', { roomCode: room.code, playerId: socket.id, category: room.category });
    io.to(room.code).emit('room_joined', {
      players: room.getPublicPlayers(),
      hostId: room.hostId,
      category: room.category,
    });
  });

  socket.on('join_room', ({ roomCode, playerName } = {}) => {
    const name = sanitizeName(playerName);
    if (!name) return socket.emit('error', { message: 'Nome inválido.' });

    const room = roomManager.getRoom(roomCode);
    if (!room) return socket.emit('error', { message: 'Sala não encontrada.' });
    if (room.state !== 'lobby') return socket.emit('error', { message: 'Esta sala já iniciou o jogo.' });
    if (room.players.size >= CONFIG.MAX_PLAYERS) return socket.emit('error', { message: 'Sala cheia.' });

    const player = { id: socket.id, name, score: 0, eliminated: false, connected: true };
    room.addPlayer(player);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = name;

    socket.emit('room_joined', { players: room.getPublicPlayers(), hostId: room.hostId, category: room.category });
    socket.to(room.code).emit('player_joined', { player: room.getPublicPlayer(player) });
  });

  socket.on('join_queue', ({ playerName, category } = {}) => {
    const name = sanitizeName(playerName);
    if (!name) return socket.emit('error', { message: 'Nome inválido.' });
    const cat = sanitizeCategory(category);
    socket.data.playerName = name;
    socket.data.category = cat;
    matchmaking.join(socket, name, cat);
  });

  socket.on('leave_queue', () => {
    matchmaking.leave(socket.id);
  });

  socket.on('start_game', ({ roomCode } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return socket.emit('error', { message: 'Sala não encontrada.' });
    if (!room.isPrivate) return socket.emit('error', { message: 'Ação não permitida.' });
    if (room.hostId !== socket.id) return socket.emit('error', { message: 'Apenas o host pode iniciar o jogo.' });
    if (room.players.size < CONFIG.MIN_PLAYERS) {
      return socket.emit('error', { message: `São necessários ao menos ${CONFIG.MIN_PLAYERS} jogadores.` });
    }
    room.startGame();
  });

  socket.on('submit_name', ({ roomCode, name } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return socket.emit('error', { message: 'Sala não encontrada.' });
    const result = room.submitName(socket.id, name);
    if (result?.error) socket.emit('error', { message: result.error });
  });

  socket.on('vote', ({ roomCode, votedName } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return socket.emit('error', { message: 'Sala não encontrada.' });
    const result = room.submitVote(socket.id, votedName);
    if (result?.error) socket.emit('error', { message: result.error });
  });

  // Reação rápida (emoji) na tela de resultado. Ignorada silenciosamente se
  // inválida/fora de hora — não é crítica o suficiente para virar um erro.
  socket.on('send_reaction', ({ roomCode, emoji } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    room.sendReaction(socket.id, emoji);
  });

  socket.on('kick_player', ({ roomCode, playerId } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return socket.emit('error', { message: 'Sala não encontrada.' });
    if (!room.isPrivate) return socket.emit('error', { message: 'Ação não permitida.' });
    if (room.hostId !== socket.id) return socket.emit('error', { message: 'Apenas o host pode expulsar jogadores.' });
    if (playerId === socket.id) return socket.emit('error', { message: 'Você não pode se expulsar.' });
    if (!room.players.has(playerId)) return socket.emit('error', { message: 'Jogador não encontrado.' });

    const kickedSocket = io.sockets.sockets.get(playerId);
    room.removePlayer(playerId);
    io.to(room.code).emit('player_kicked', { playerId });
    if (kickedSocket) {
      kickedSocket.leave(room.code);
      kickedSocket.data.roomCode = null;
    }
    if (room.players.size === 0) roomManager.deleteRoom(room.code);
  });

  socket.on('restart_game', ({ roomCode } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return socket.emit('error', { message: 'Sala não encontrada.' });
    if (!room.isPrivate) return socket.emit('error', { message: 'Ação não permitida.' });
    if (room.hostId !== socket.id) return socket.emit('error', { message: 'Apenas o host pode reiniciar o jogo.' });
    room.resetToLobby();
    io.to(room.code).emit('room_joined', {
      players: room.getPublicPlayers(),
      hostId: room.hostId,
      category: room.category,
    });
  });

  socket.on('play_again', () => {
    const name = socket.data.playerName;
    if (!name) return socket.emit('error', { message: 'Nome não encontrado.' });
    socket.data.roomCode = null;
    matchmaking.join(socket, name, socket.data.category);
  });

  // Evento auxiliar para reconexão (não listado na tabela original, mas
  // necessário para cumprir a regra de negócio de 30s de tolerância).
  socket.on('rejoin_room', ({ roomCode, playerId } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return socket.emit('error', { message: 'Sala não encontrada ou expirada.' });
    const player = room.reconnectPlayer(playerId, socket.id);
    if (!player) return socket.emit('error', { message: 'Não foi possível reconectar.' });

    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = player.name;

    socket.emit('room_joined', { players: room.getPublicPlayers(), hostId: room.hostId, category: room.category });
    if (room.state !== 'lobby' && room.state !== 'game_over') {
      socket.emit('game_state', room.snapshot());
    }
    socket.to(room.code).emit('player_joined', { player: room.getPublicPlayer(player) });
  });

  socket.on('disconnect', () => {
    matchmaking.leave(socket.id);

    const code = socket.data.roomCode;
    if (!code) return;
    const room = roomManager.getRoom(code);
    if (!room) return;

    if (room.state === 'lobby' || room.state === 'game_over') {
      room.removePlayer(socket.id);
      io.to(room.code).emit('player_left', { playerId: socket.id });
      if (room.players.size === 0) {
        roomManager.deleteRoom(room.code);
      } else if (room.isPrivate) {
        io.to(room.code).emit('room_joined', { players: room.getPublicPlayers(), hostId: room.hostId });
      }
    } else {
      room.markDisconnected(socket.id, () => {
        io.to(room.code).emit('player_left', { playerId: socket.id });
        if (room.players.size === 0) roomManager.deleteRoom(room.code);
      });
      io.to(room.code).emit('game_state', room.snapshot());
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`O Meu é Melhor - servidor rodando na porta ${PORT}`);
});
