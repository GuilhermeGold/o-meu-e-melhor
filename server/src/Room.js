import { CONFIG } from './config.js';
import { normalizeForDedup, pickRandomCategory, pickRandomLetter, shuffle } from './utils.js';

/**
 * Room é a fonte da verdade para uma partida (privada ou pública já formada).
 * Todos os timers rodam aqui, no servidor; o cliente só exibe o que recebe.
 */
export class Room {
  constructor(io, code, { isPrivate = true, category = CONFIG.DEFAULT_CATEGORY } = {}) {
    this.io = io;
    this.code = code;
    this.isPrivate = isPrivate;
    this.category = category;
    this.players = new Map(); // playerId -> player
    this.hostId = null;
    this.state = isPrivate ? 'lobby' : 'choosing';
    this.round = 0;
    this.letter = null;
    this.roundCategory = null; // categoria efetiva da rodada (igual a this.category, exceto no modo "misterio")
    this.submissions = new Map(); // playerId -> name (como o jogador digitou)
    this.canonicalSubmissions = new Map(); // playerId -> nome após dedupe (mesma grafia p/ quem confirmou o "mesmo" nome)
    this.votes = new Map(); // playerId -> votedName
    this.votingNames = [];
    this.usedLetters = new Set();
    this.timer = null;
    this.chatLog = []; // { id, playerId, playerName, text, system, ts }[]
  }

  // ---------- Jogadores ----------

  addPlayer(player) {
    this.players.set(player.id, player);
    if (this.isPrivate && this.hostId === null) {
      this.hostId = player.id;
    }
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    this.players.delete(playerId);
    this.submissions.delete(playerId);
    this.canonicalSubmissions.delete(playerId);
    this.votes.delete(playerId);
    if (this.isPrivate && this.hostId === playerId) {
      const next = [...this.players.values()][0];
      this.hostId = next ? next.id : null;
    }
  }

  markDisconnected(playerId, onRemoved) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    player.disconnectTimer = setTimeout(() => {
      this.removePlayer(playerId);
      onRemoved?.();
    }, CONFIG.RECONNECT_GRACE * 1000);
  }

  reconnectPlayer(oldId, newSocketId) {
    const player = this.players.get(oldId);
    if (!player || player.connected) return null;
    clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
    player.connected = true;
    this.players.delete(oldId);
    player.id = newSocketId;
    this.players.set(newSocketId, player);
    if (this.submissions.has(oldId)) {
      this.submissions.set(newSocketId, this.submissions.get(oldId));
      this.submissions.delete(oldId);
    }
    if (this.canonicalSubmissions.has(oldId)) {
      this.canonicalSubmissions.set(newSocketId, this.canonicalSubmissions.get(oldId));
      this.canonicalSubmissions.delete(oldId);
    }
    if (this.votes.has(oldId)) {
      this.votes.set(newSocketId, this.votes.get(oldId));
      this.votes.delete(oldId);
    }
    if (this.hostId === oldId) this.hostId = newSocketId;
    return player;
  }

  // ---------- Ciclo de jogo ----------

  startGame() {
    if (this.isPrivate && this.state !== 'lobby') return;
    this.round = 1;
    this.usedLetters = new Set();
    for (const p of this.players.values()) {
      p.score = 0;
      p.eliminated = false;
    }
    this.io.to(this.code).emit('game_started', { state: this.snapshot() });
    this._beginChoosingPhase();
  }

  resetToLobby() {
    this._clearTimer();
    this.state = 'lobby';
    this.round = 0;
    this.letter = null;
    this.roundCategory = null;
    this.submissions = new Map();
    this.canonicalSubmissions = new Map();
    this.votes = new Map();
    this.votingNames = [];
    this.usedLetters = new Set();
    for (const p of this.players.values()) {
      p.score = 0;
      p.eliminated = false;
    }
  }

  destroy() {
    this._clearTimer();
    for (const p of this.players.values()) {
      if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    }
  }

  /** O host pula a rodada atual (escolha, votação ou resultado) sem aplicar pontos negativos. */
  skipRound() {
    if (this.state === 'lobby' || this.state === 'game_over') {
      return { error: 'Não é possível pular agora.' };
    }
    this._clearTimer();
    this.round += 1;
    this.addSystemMessage('⏭ O host pulou a rodada.');
    this._beginChoosingPhase();
    return { ok: true };
  }

  _beginChoosingPhase() {
    this.state = 'choosing';
    this.letter = pickRandomLetter(this.usedLetters);
    this.usedLetters.add(this.letter);
    // No modo "misterio" a categoria é sorteada de novo a cada rodada; nas
    // demais, a rodada sempre usa a categoria fixa da sala.
    this.roundCategory = this.category === 'misterio' ? pickRandomCategory() : this.category;
    this.submissions = new Map();
    this.canonicalSubmissions = new Map();
    this.votes = new Map();
    this.votingNames = [];
    this._broadcastState();
    this._runTimer(
      CONFIG.CHOOSING_TIME,
      (timeLeft) => this._broadcastState(timeLeft),
      () => this._endChoosingPhase()
    );
  }

  submitName(playerId, name) {
    if (this.state !== 'choosing') return { error: 'Fase de escolha não está ativa.' };
    const player = this.players.get(playerId);
    if (!player) return { error: 'Jogador inválido.' };
    const trimmed = (name || '').toString().trim().slice(0, CONFIG.MAX_SUBMISSION_LENGTH);
    if (!trimmed) return { error: 'Nome não pode ser vazio.' };
    if (this.submissions.has(playerId)) return { error: 'Você já confirmou seu nome nesta rodada.' };
    this.submissions.set(playerId, trimmed);
    const total = this.players.size;
    this.io.to(this.code).emit('player_confirmed', { confirmedCount: this.submissions.size, total });
    if (this.submissions.size >= total) {
      this._endChoosingPhase();
    }
    return { ok: true };
  }

  _endChoosingPhase() {
    this._clearTimer();
    const losers = [];
    for (const p of this.players.values()) {
      if (!this.submissions.has(p.id) && this._applyNegativePoint(p.id)) {
        losers.push(p.id);
      }
    }
    if (losers.length > 0) return this._endGame(losers);
    this._beginVotingPhase();
  }

  _beginVotingPhase() {
    // Agrupa submissões que se referem ao "mesmo" nome apesar de grafias
    // diferentes (maiúsculas/minúsculas, acentos, espaços), para que não
    // virem opções de voto separadas e dividam os votos entre si. A grafia
    // do primeiro jogador que confirmou aquele nome é a que prevalece.
    this.canonicalSubmissions = new Map();
    const canonicalByKey = new Map();
    for (const [playerId, name] of this.submissions.entries()) {
      const key = normalizeForDedup(name);
      if (!canonicalByKey.has(key)) canonicalByKey.set(key, name);
      const canonicalName = canonicalByKey.get(key);
      this.canonicalSubmissions.set(playerId, canonicalName);
      if (canonicalName !== name) {
        this.io.to(playerId).emit('submission_merged', { name: canonicalName });
      }
    }

    const uniqueNames = [...new Set(this.canonicalSubmissions.values())];
    if (uniqueNames.length < 2) {
      // Não há nomes suficientes para uma votação válida (todos empatados na
      // autoria ou só um jogador confirmou). Pula direto para o resultado.
      this.votingNames = uniqueNames;
      this.votes = new Map();
      this._beginResultsPhase();
      return;
    }
    this.state = 'voting';
    this.votingNames = shuffle(uniqueNames);
    this.votes = new Map();
    this._broadcastState();
    this._runTimer(
      CONFIG.VOTING_TIME,
      (timeLeft) => this._broadcastState(timeLeft),
      () => this._endVotingPhase()
    );
  }

  submitVote(playerId, votedName) {
    if (this.state !== 'voting') return { error: 'Fase de votação não está ativa.' };
    const player = this.players.get(playerId);
    if (!player) return { error: 'Jogador inválido.' };
    if (!this.submissions.has(playerId)) return { error: 'Você não participou da escolha desta rodada.' };
    if (!this.votingNames.includes(votedName)) return { error: 'Nome inválido.' };
    if (this.votes.has(playerId)) return { error: 'Você já votou nesta rodada.' };
    const ownName = this.canonicalSubmissions.get(playerId);
    if (votedName === ownName) return { error: 'Você não pode votar no seu próprio nome.' };
    this.votes.set(playerId, votedName);

    if (this.votes.size >= this.submissions.size) {
      this._endVotingPhase();
    }
    return { ok: true };
  }

  _endVotingPhase() {
    this._clearTimer();
    this._beginResultsPhase();
  }

  _beginResultsPhase() {
    this.state = 'results';

    const tally = {};
    for (const name of this.votingNames) tally[name] = 0;
    for (const votedName of this.votes.values()) {
      tally[votedName] = (tally[votedName] || 0) + 1;
    }

    let maxVotes = 0;
    for (const c of Object.values(tally)) maxVotes = Math.max(maxVotes, c);
    const losers = maxVotes > 0 ? Object.keys(tally).filter((name) => tally[name] === maxVotes) : [];

    const nameAuthors = {};
    for (const [playerId, name] of this.canonicalSubmissions.entries()) {
      if (!nameAuthors[name]) nameAuthors[name] = [];
      nameAuthors[name].push(playerId);
    }

    const newLosers = [];
    for (const [playerId, name] of this.canonicalSubmissions.entries()) {
      if (losers.includes(name) && this._applyNegativePoint(playerId)) {
        newLosers.push(playerId);
      }
    }

    this.io.to(this.code).emit('round_results', {
      votes: tally,
      losers,
      nameAuthors,
      scores: this._scoresMap(),
    });
    this._broadcastState();

    if (newLosers.length > 0) return this._endGame(newLosers);

    this._runTimer(
      CONFIG.RESULTS_TIME,
      (timeLeft) => this._broadcastState(timeLeft),
      () => {
        this.round += 1;
        this._beginChoosingPhase();
      }
    );
  }

  /** Soma um ponto negativo e retorna true se o jogador acabou de atingir o limite. */
  _applyNegativePoint(playerId) {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.score += 1;
    return player.score >= CONFIG.ELIMINATION_THRESHOLD;
  }

  /** O jogo acaba assim que o primeiro jogador atinge o limite de pontos negativos. */
  _endGame(loserIds) {
    this._clearTimer();
    this.state = 'game_over';
    for (const id of loserIds) {
      const player = this.players.get(id);
      if (player) player.eliminated = true;
      this.io.to(this.code).emit('player_eliminated', { playerId: id });
    }
    const losers = loserIds.map((id) => this.getPublicPlayer(this.players.get(id))).filter(Boolean);
    this.io.to(this.code).emit('game_over', {
      loser: losers[0] ?? null,
      losers,
      finalScores: this._scoresMap(),
    });
  }

  // ---------- Timers ----------

  _runTimer(seconds, onTick, onEnd) {
    this._clearTimer();
    let remaining = seconds;
    onTick(remaining);
    this.timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        this._clearTimer();
        onEnd();
      } else {
        onTick(remaining);
      }
    }, 1000);
  }

  _clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ---------- Serialização ----------

  _broadcastState(timeLeft) {
    this.io.to(this.code).emit('game_state', {
      phase: this.state,
      letter: this.letter,
      timeLeft: timeLeft ?? null,
      players: this.getPublicPlayers(),
      names: this.state === 'voting' ? this.votingNames : undefined,
      category: this.category,
      roundCategory: this.roundCategory,
    });
  }

  // ---------- Chat ----------

  /** Mensagem de um jogador, disponível em qualquer fase da partida. */
  addChatMessage(playerId, text) {
    const player = this.players.get(playerId);
    if (!player) return { error: 'Jogador inválido.' };
    const trimmed = (text || '').toString().trim().slice(0, CONFIG.MAX_CHAT_LENGTH);
    if (!trimmed) return { error: 'Mensagem não pode ser vazia.' };
    this._pushChatMessage({
      id: `${playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId,
      playerName: player.name,
      text: trimmed,
      ts: Date.now(),
    });
    return { ok: true };
  }

  /** Aviso do sistema (ex.: host pulou a rodada), sem autor. */
  addSystemMessage(text) {
    this._pushChatMessage({
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      system: true,
      text,
      ts: Date.now(),
    });
  }

  _pushChatMessage(message) {
    this.chatLog.push(message);
    if (this.chatLog.length > CONFIG.CHAT_LOG_LIMIT) this.chatLog.shift();
    this.io.to(this.code).emit('chat_message', message);
  }

  /** Reação rápida (emoji) na tela de resultado. Sem histórico — só um relay efêmero. */
  sendReaction(playerId, emoji) {
    if (this.state !== 'results') return;
    if (!CONFIG.REACTIONS.includes(emoji)) return;
    const player = this.players.get(playerId);
    if (!player) return;
    this.io.to(this.code).emit('reaction', {
      id: `${playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId,
      playerName: player.name,
      emoji,
    });
  }

  _scoresMap() {
    const scores = {};
    for (const p of this.players.values()) scores[p.id] = p.score;
    return scores;
  }

  getPublicPlayer(p) {
    return {
      id: p.id,
      name: p.name,
      score: p.score,
      eliminated: p.eliminated,
      connected: p.connected,
      isHost: this.isPrivate && p.id === this.hostId,
    };
  }

  getPublicPlayers() {
    return [...this.players.values()].map((p) => this.getPublicPlayer(p));
  }

  snapshot() {
    return {
      phase: this.state,
      letter: this.state === 'choosing' ? this.letter : null,
      timeLeft: null,
      players: this.getPublicPlayers(),
      names: this.state === 'voting' ? this.votingNames : undefined,
      category: this.category,
      roundCategory: this.state === 'choosing' ? this.roundCategory : null,
    };
  }
}
