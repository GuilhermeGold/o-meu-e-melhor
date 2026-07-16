export const CHOOSING_TIME = 60;
export const VOTING_TIME = 30;
export const RESULTS_TIME = 8;

export const CATEGORY_INFO = {
  pessoa: { label: 'Pessoa', pluralLabel: 'Pessoas', article: 'uma', noun: 'pessoa' },
  objeto: { label: 'Objeto', pluralLabel: 'Objetos', article: 'um', noun: 'objeto' },
  comida: { label: 'Comida', pluralLabel: 'Comidas', article: 'uma', noun: 'comida' },
  verbo: { label: 'Verbo', pluralLabel: 'Verbos', article: 'um', noun: 'verbo' },
  lugar: { label: 'Lugar', pluralLabel: 'Lugares', article: 'um', noun: 'lugar' },
  // "misterio" não tem artigo/substantivo próprio: a categoria de cada
  // rodada é sorteada entre as outras e chega separadamente (roundCategory).
  misterio: { label: 'Mistério', pluralLabel: 'Mistério' },
};

// Categorias que o jogador escolhe ao criar a sala / entrar na fila.
// comida/verbo/lugar só aparecem sorteadas dentro do modo "misterio".
const SELECTABLE_CATEGORIES = ['pessoa', 'objeto', 'misterio'];

export const CATEGORIES = SELECTABLE_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_INFO[value].label,
}));

// Precisa bater com CONFIG.REACTIONS no servidor.
export const REACTIONS = ['😂', '💀', '🤡', '🔥', '👎', '😱'];

// Precisa bater com CONFIG.MAX_CHAT_LENGTH no servidor.
export const MAX_CHAT_LENGTH = 200;
