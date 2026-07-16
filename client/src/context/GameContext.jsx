import { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { socket } from '../socket.js';

const SESSION_KEY = 'omem_session';

const initialState = {
  screen: 'home', // home | lobby | queue | game | game_over
  mode: null, // 'private' | 'public'
  category: 'pessoa', // 'pessoa' | 'objeto' | 'misterio'
  roundCategory: null, // categoria efetiva da rodada atual (relevante no modo "misterio")
  roomCode: null,
  playerId: null,
  playerName: '',
  hostId: null,
  players: [],

  queueSize: 0,
  countdown: null,

  phase: null, // choosing | voting | results
  letter: null,
  timeLeft: null,
  confirmedCount: 0,
  totalToConfirm: 0,
  mySubmission: null,
  votingNames: [],
  myVote: null,
  roundResults: null, // { votes, losers, nameAuthors, scores }

  gameOver: null, // { loser, losers, finalScores }
  reactions: [], // reações rápidas ao vivo na tela de resultado: { id, playerId, playerName, emoji }
  chatMessages: [], // { id, playerId, playerName, text, system, ts }
  error: null,
  wasKicked: false,
};

function saveSession(roomCode, playerId) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId }));
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_IDENTITY':
      return {
        ...state,
        mode: action.mode,
        playerName: action.playerName,
        roomCode: action.roomCode ?? state.roomCode,
        category: action.category ?? state.category,
        error: null,
      };

    case 'ROOM_CREATED':
      return {
        ...state,
        screen: 'lobby',
        roomCode: action.roomCode,
        playerId: action.playerId,
        category: action.category ?? state.category,
      };

    case 'ROOM_JOINED':
      // room_joined só é emitido em estado de lobby (criar/entrar/reiniciar)
      // ou logo antes de um game_state de reconexão, que corrige a tela
      // imediatamente em seguida caso a partida já esteja em andamento.
      return {
        ...state,
        screen: 'lobby',
        mode: 'private',
        players: action.players,
        hostId: action.hostId,
        category: action.category ?? state.category,
        roundCategory: null,
        playerId: state.playerId ?? socket.id,
        gameOver: null,
        roundResults: null,
        phase: null,
        chatMessages: action.chatLog ?? state.chatMessages,
      };

    case 'QUEUE_JOINED':
      return {
        ...state,
        screen: 'queue',
        mode: 'public',
        queueSize: action.queueSize,
        category: action.category ?? state.category,
        playerId: socket.id,
        countdown: null,
      };

    case 'QUEUE_UPDATED':
      return { ...state, queueSize: action.queueSize };

    case 'MATCHMAKING_COUNTDOWN':
      return { ...state, countdown: action.seconds };

    case 'MATCH_FOUND':
      return {
        ...state,
        screen: 'game',
        mode: 'public',
        roomCode: action.roomCode,
        players: action.players,
        category: action.category ?? state.category,
        roundCategory: null,
        playerId: socket.id,
        countdown: null,
        gameOver: null,
        chatMessages: action.chatLog ?? state.chatMessages,
      };

    case 'PLAYER_JOINED':
      if (state.players.some((p) => p.id === action.player.id)) return state;
      return { ...state, players: [...state.players, action.player] };

    case 'PLAYER_LEFT':
      return { ...state, players: state.players.filter((p) => p.id !== action.playerId) };

    case 'PLAYER_KICKED':
      return { ...state, players: state.players.filter((p) => p.id !== action.playerId) };

    case 'KICKED_SELF':
      return { ...initialState, wasKicked: true };

    case 'GAME_STATE': {
      const { phase, letter, timeLeft, players, names, category, roundCategory } = action.state;
      const newLetter = letter ?? state.letter;
      // Uma nova rodada é detectada pela troca de fase (fluxo normal) OU pela
      // troca de letra (host pulou a rodada de dentro da mesma fase, ex.:
      // choosing -> choosing). As duas condições juntas cobrem ambos os casos.
      const roundChanged = state.phase !== phase || newLetter !== state.letter;
      return {
        ...state,
        screen: 'game',
        phase,
        letter: newLetter,
        timeLeft: timeLeft ?? null,
        players: players ?? state.players,
        category: category ?? state.category,
        roundCategory: roundCategory ?? state.roundCategory,
        votingNames: phase === 'voting' ? names ?? state.votingNames : state.votingNames,
        mySubmission: phase === 'choosing' && roundChanged ? null : state.mySubmission,
        myVote: phase === 'voting' && roundChanged ? null : state.myVote,
        confirmedCount: phase === 'choosing' && roundChanged ? 0 : state.confirmedCount,
        totalToConfirm: phase === 'choosing' && roundChanged ? 0 : state.totalToConfirm,
        roundResults: phase === 'results' ? state.roundResults : null,
      };
    }

    case 'PLAYER_CONFIRMED':
      return { ...state, confirmedCount: action.confirmedCount, totalToConfirm: action.total };

    case 'MY_SUBMISSION':
      return { ...state, mySubmission: action.name };

    case 'MY_VOTE':
      return { ...state, myVote: action.votedName };

    case 'ROUND_RESULTS':
      return { ...state, roundResults: action.data };

    case 'PLAYER_ELIMINATED':
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.playerId ? { ...p, eliminated: true } : p)),
      };

    case 'GAME_OVER':
      return { ...state, screen: 'game_over', gameOver: action.data };

    case 'REACTION_RECEIVED':
      return { ...state, reactions: [...state.reactions, action.reaction] };

    case 'REACTION_EXPIRED':
      return { ...state, reactions: state.reactions.filter((r) => r.id !== action.id) };

    case 'CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.message].slice(-100) };

    case 'ERROR':
      return { ...state, error: action.message };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'PLAY_AGAIN':
      return {
        ...initialState,
        mode: 'public',
        playerName: state.playerName,
        category: state.category,
        screen: 'queue',
      };

    case 'GO_HOME':
      return { ...initialState, playerName: state.playerName };

    default:
      return state;
  }
}

const GameStateContext = createContext(null);
const GameActionsContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onConnect = () => {
      const saved = loadSession();
      if (saved?.roomCode && saved?.playerId && saved.playerId !== socket.id) {
        socket.emit('rejoin_room', { roomCode: saved.roomCode, playerId: saved.playerId });
      }
    };

    const onRoomCreated = ({ roomCode, playerId, category }) => {
      saveSession(roomCode, playerId);
      dispatch({ type: 'ROOM_CREATED', roomCode, playerId, category });
    };
    const onRoomJoined = ({ players, hostId, category, chatLog }) => {
      if (stateRef.current.roomCode) saveSession(stateRef.current.roomCode, socket.id);
      dispatch({ type: 'ROOM_JOINED', players, hostId, category, chatLog });
    };
    const onQueueJoined = ({ queueSize, category }) => dispatch({ type: 'QUEUE_JOINED', queueSize, category });
    const onQueueUpdated = ({ queueSize }) => dispatch({ type: 'QUEUE_UPDATED', queueSize });
    const onCountdown = ({ seconds }) => dispatch({ type: 'MATCHMAKING_COUNTDOWN', seconds });
    const onMatchFound = ({ roomCode, players, category, chatLog }) => {
      saveSession(roomCode, socket.id);
      dispatch({ type: 'MATCH_FOUND', roomCode, players, category, chatLog });
    };
    const onPlayerJoined = ({ player }) => dispatch({ type: 'PLAYER_JOINED', player });
    const onPlayerLeft = ({ playerId }) => dispatch({ type: 'PLAYER_LEFT', playerId });
    const onPlayerKicked = ({ playerId }) => {
      if (playerId === socket.id) {
        clearSession();
        dispatch({ type: 'KICKED_SELF' });
      } else {
        dispatch({ type: 'PLAYER_KICKED', playerId });
      }
    };
    const onGameStarted = () => dispatch({ type: 'CLEAR_ERROR' });
    const onGameState = (payload) => dispatch({ type: 'GAME_STATE', state: payload });
    const onPlayerConfirmed = (payload) => dispatch({ type: 'PLAYER_CONFIRMED', ...payload });
    // Outro jogador confirmou o "mesmo" nome (grafia diferente) antes de nós;
    // a votação usa a grafia dele, então atualizamos a nossa também.
    const onSubmissionMerged = ({ name }) => dispatch({ type: 'MY_SUBMISSION', name });
    const onRoundResults = (data) => dispatch({ type: 'ROUND_RESULTS', data });
    const onPlayerEliminated = ({ playerId }) => dispatch({ type: 'PLAYER_ELIMINATED', playerId });
    const onGameOver = (data) => {
      clearSession();
      dispatch({ type: 'GAME_OVER', data });
    };
    const onReaction = (reaction) => {
      dispatch({ type: 'REACTION_RECEIVED', reaction });
      // Efêmera: some sozinha depois de alguns segundos, sem precisar de ação do usuário.
      setTimeout(() => dispatch({ type: 'REACTION_EXPIRED', id: reaction.id }), 2600);
    };
    const onError = ({ message }) => dispatch({ type: 'ERROR', message });
    const onChatMessage = (message) => dispatch({ type: 'CHAT_MESSAGE', message });

    socket.on('connect', onConnect);
    socket.on('room_created', onRoomCreated);
    socket.on('room_joined', onRoomJoined);
    socket.on('queue_joined', onQueueJoined);
    socket.on('queue_updated', onQueueUpdated);
    socket.on('matchmaking_countdown', onCountdown);
    socket.on('match_found', onMatchFound);
    socket.on('player_joined', onPlayerJoined);
    socket.on('player_left', onPlayerLeft);
    socket.on('player_kicked', onPlayerKicked);
    socket.on('game_started', onGameStarted);
    socket.on('game_state', onGameState);
    socket.on('player_confirmed', onPlayerConfirmed);
    socket.on('submission_merged', onSubmissionMerged);
    socket.on('round_results', onRoundResults);
    socket.on('player_eliminated', onPlayerEliminated);
    socket.on('game_over', onGameOver);
    socket.on('reaction', onReaction);
    socket.on('chat_message', onChatMessage);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('room_created', onRoomCreated);
      socket.off('room_joined', onRoomJoined);
      socket.off('queue_joined', onQueueJoined);
      socket.off('queue_updated', onQueueUpdated);
      socket.off('matchmaking_countdown', onCountdown);
      socket.off('match_found', onMatchFound);
      socket.off('player_joined', onPlayerJoined);
      socket.off('player_left', onPlayerLeft);
      socket.off('player_kicked', onPlayerKicked);
      socket.off('game_started', onGameStarted);
      socket.off('game_state', onGameState);
      socket.off('player_confirmed', onPlayerConfirmed);
      socket.off('submission_merged', onSubmissionMerged);
      socket.off('round_results', onRoundResults);
      socket.off('player_eliminated', onPlayerEliminated);
      socket.off('game_over', onGameOver);
      socket.off('reaction', onReaction);
      socket.off('chat_message', onChatMessage);
      socket.off('error', onError);
    };
  }, []);

  const actions = {
    createRoom(playerName, category) {
      dispatch({ type: 'SET_IDENTITY', mode: 'private', playerName, category });
      socket.emit('create_room', { playerName, category });
    },
    joinRoom(roomCode, playerName) {
      const code = roomCode.trim().toUpperCase();
      dispatch({ type: 'SET_IDENTITY', mode: 'private', playerName, roomCode: code });
      socket.emit('join_room', { roomCode: code, playerName });
    },
    joinQueue(playerName, category) {
      dispatch({ type: 'SET_IDENTITY', mode: 'public', playerName, category });
      socket.emit('join_queue', { playerName, category });
    },
    leaveQueue() {
      socket.emit('leave_queue');
      dispatch({ type: 'GO_HOME' });
    },
    startGame() {
      socket.emit('start_game', { roomCode: stateRef.current.roomCode });
    },
    submitName(name) {
      socket.emit('submit_name', { roomCode: stateRef.current.roomCode, name });
      dispatch({ type: 'MY_SUBMISSION', name });
    },
    vote(votedName) {
      socket.emit('vote', { roomCode: stateRef.current.roomCode, votedName });
      dispatch({ type: 'MY_VOTE', votedName });
    },
    sendReaction(emoji) {
      socket.emit('send_reaction', { roomCode: stateRef.current.roomCode, emoji });
    },
    kickPlayer(playerId) {
      socket.emit('kick_player', { roomCode: stateRef.current.roomCode, playerId });
    },
    skipRound() {
      socket.emit('skip_round', { roomCode: stateRef.current.roomCode });
    },
    sendChatMessage(text) {
      socket.emit('chat_message', { roomCode: stateRef.current.roomCode, text });
    },
    restartGame() {
      socket.emit('restart_game', { roomCode: stateRef.current.roomCode });
    },
    playAgain() {
      clearSession();
      socket.emit('play_again');
      dispatch({ type: 'PLAY_AGAIN' });
    },
    goHome() {
      clearSession();
      socket.emit('leave_queue');
      if (stateRef.current.roomCode) {
        // Força o servidor a processar a saída (limpa/transfere host, ou
        // destrói a sala se ninguém mais restar).
        socket.disconnect();
        socket.connect();
      }
      dispatch({ type: 'GO_HOME' });
    },
    clearError() {
      dispatch({ type: 'CLEAR_ERROR' });
    },
  };

  return (
    <GameStateContext.Provider value={state}>
      <GameActionsContext.Provider value={actions}>{children}</GameActionsContext.Provider>
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error('useGameState deve ser usado dentro de GameProvider');
  return ctx;
}

export function useGameActions() {
  const ctx = useContext(GameActionsContext);
  if (!ctx) throw new Error('useGameActions deve ser usado dentro de GameProvider');
  return ctx;
}
