import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Permite acessar o dev server através de um túnel público (o subdomínio
    // do Cloudflare Tunnel muda a cada execução, então liberamos o domínio todo).
    allowedHosts: ['.trycloudflare.com'],
    // Encaminha o tráfego do Socket.io para o backend, permitindo expor só
    // esta porta (útil para túneis públicos como o Cloudflare Tunnel).
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
