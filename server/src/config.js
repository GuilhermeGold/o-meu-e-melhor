export const CONFIG = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 8,
  ELIMINATION_THRESHOLD: 3,
  CHOOSING_TIME: 60,
  VOTING_TIME: 30,
  RESULTS_TIME: 8,
  MATCHMAKING_COUNTDOWN: 30,
  RECONNECT_GRACE: 30,
  // A-Z excluindo K, W, X, Y
  LETTERS: 'ABCDEFGHIJLMNOPQRSTUVZ'.split(''),
  MAX_NAME_LENGTH: 20,
  MAX_SUBMISSION_LENGTH: 40,
  // Categorias de jogo selecionáveis ao criar/entrar na fila. Cada sala tem
  // exatamente uma; a regra do jogo é sempre a mesma, só muda o que os
  // jogadores confirmam. "misterio" sorteia uma categoria diferente
  // (dentre MYSTERY_CATEGORIES) a cada rodada, dentro da mesma sala.
  CATEGORIES: ['pessoa', 'objeto', 'misterio'],
  MYSTERY_CATEGORIES: ['pessoa', 'objeto', 'comida', 'verbo', 'lugar'],
  DEFAULT_CATEGORY: 'pessoa',
  // Emojis permitidos nas reações rápidas da tela de resultado.
  REACTIONS: ['😂', '💀', '🤡', '🔥', '👎', '😱'],
};
