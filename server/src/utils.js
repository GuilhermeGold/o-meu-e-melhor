import { CONFIG } from './config.js';

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateRoomCode(existingCodes) {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (existingCodes.has(code));
  return code;
}

export function pickRandomLetter(excluded = new Set()) {
  const available = CONFIG.LETTERS.filter((l) => !excluded.has(l));
  // Se todas as letras já saíram nesta sala, recomeça o ciclo.
  const pool = available.length > 0 ? available : CONFIG.LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickRandomCategory() {
  const pool = CONFIG.MYSTERY_CATEGORIES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Chave para detectar submissões que se referem ao mesmo nome apesar de
 * grafias diferentes (maiúsculas/minúsculas, acentos, espaços extras).
 * Não trata apelidos nem erros de digitação — só normalização determinística.
 */
export function normalizeForDedup(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove marcas diacríticas (acentos)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
