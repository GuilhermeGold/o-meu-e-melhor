import { CONFIG } from './config.js';
import { Room } from './Room.js';
import { generateRoomCode } from './utils.js';

const QUEUE_CHANNEL_PREFIX = 'matchmaking_lobby_';

/**
 * Fila global de matchmaking público. Sem host: quando reúne jogadores
 * suficientes, cria uma Room e inicia o jogo automaticamente.
 * Cada categoria tem sua própria fila e sala de socket.io, já que uma sala
 * só pode ter uma categoria de jogo.
 */
export class MatchmakingQueue {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.buckets = new Map(); // category -> { queue: [], countdownTimer: null }
    for (const category of CONFIG.CATEGORIES) {
      this.buckets.set(category, { queue: [], countdownTimer: null });
    }
  }

  _normalizeCategory(category) {
    return CONFIG.CATEGORIES.includes(category) ? category : CONFIG.DEFAULT_CATEGORY;
  }

  _channel(category) {
    return `${QUEUE_CHANNEL_PREFIX}${category}`;
  }

  join(socket, playerName, category) {
    const cat = this._normalizeCategory(category);
    const bucket = this.buckets.get(cat);
    if (bucket.queue.some((p) => p.id === socket.id)) return;
    bucket.queue.push({ id: socket.id, name: playerName, socket });
    socket.join(this._channel(cat));
    socket.emit('queue_joined', { queueSize: bucket.queue.length, category: cat });
    this._broadcastQueueSize(cat);

    if (bucket.queue.length >= CONFIG.MAX_PLAYERS) {
      this._startMatch(cat);
      return;
    }
    if (bucket.queue.length >= CONFIG.MIN_PLAYERS && !bucket.countdownTimer) {
      this._startCountdown(cat);
    }
  }

  leave(socketId) {
    for (const [category, bucket] of this.buckets) {
      const idx = bucket.queue.findIndex((p) => p.id === socketId);
      if (idx === -1) continue;
      const [removed] = bucket.queue.splice(idx, 1);
      removed.socket.leave(this._channel(category));
      this._broadcastQueueSize(category);
      if (bucket.queue.length < CONFIG.MIN_PLAYERS) {
        this._cancelCountdown(category);
      }
      return;
    }
  }

  _broadcastQueueSize(category) {
    const bucket = this.buckets.get(category);
    this.io.to(this._channel(category)).emit('queue_updated', { queueSize: bucket.queue.length });
  }

  _startCountdown(category) {
    const bucket = this.buckets.get(category);
    let remaining = CONFIG.MATCHMAKING_COUNTDOWN;
    this.io.to(this._channel(category)).emit('matchmaking_countdown', { seconds: remaining });
    bucket.countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        this._cancelCountdown(category);
        this._startMatch(category);
      } else {
        this.io.to(this._channel(category)).emit('matchmaking_countdown', { seconds: remaining });
      }
    }, 1000);
  }

  _cancelCountdown(category) {
    const bucket = this.buckets.get(category);
    if (bucket.countdownTimer) {
      clearInterval(bucket.countdownTimer);
      bucket.countdownTimer = null;
    }
  }

  _startMatch(category) {
    this._cancelCountdown(category);
    const bucket = this.buckets.get(category);
    const matchSize = Math.min(bucket.queue.length, CONFIG.MAX_PLAYERS);
    if (matchSize < CONFIG.MIN_PLAYERS) return;
    const matchedPlayers = bucket.queue.splice(0, matchSize);

    const code = generateRoomCode(this.roomManager.existingCodes());
    const room = new Room(this.io, code, { isPrivate: false, category });
    for (const p of matchedPlayers) {
      p.socket.leave(this._channel(category));
      p.socket.join(code);
      p.socket.data.roomCode = code;
      room.addPlayer({ id: p.id, name: p.name, score: 0, eliminated: false, connected: true });
    }
    this.roomManager.registerPublicRoom(room);
    this.io.to(code).emit('match_found', {
      roomCode: code,
      players: room.getPublicPlayers(),
      category: room.category,
    });
    room.startGame();

    this._broadcastQueueSize(category);
    if (bucket.queue.length >= CONFIG.MIN_PLAYERS && !bucket.countdownTimer) {
      this._startCountdown(category);
    }
  }
}
