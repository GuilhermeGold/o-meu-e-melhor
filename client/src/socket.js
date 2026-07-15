import { io } from 'socket.io-client';

// Sem VITE_SERVER_URL definido, conecta na própria origem (o Vite faz o
// proxy de /socket.io para o backend — ver vite.config.js). Isso permite
// expor só uma porta ao compartilhar o jogo por túnel.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || undefined;

export const socket = io(SERVER_URL, {
  autoConnect: true,
});
