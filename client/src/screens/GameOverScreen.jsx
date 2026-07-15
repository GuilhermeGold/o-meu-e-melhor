import { useEffect, useMemo, useState } from 'react';
import { useGameActions, useGameState } from '../context/GameContext.jsx';

const CONFETTI_EMOJI = ['🤣', '💀', '🐌', '🤡', '🍅', '😂', '🥴', '👎'];

function useConfetti(count = 36) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        emoji: CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)],
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.5 + Math.random() * 2,
        drift: (Math.random() - 0.5) * 120,
        size: 1.2 + Math.random() * 1.4,
      })),
    [count]
  );
}

export default function GameOverScreen() {
  const { gameOver, mode, hostId, playerId, players } = useGameState();
  const { restartGame, playAgain, goHome } = useGameActions();
  const confetti = useConfetti();
  // Segura a revelação por um instante pra criar suspense antes do impacto.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  const isHost = mode === 'private' && hostId === playerId;
  const finalScores = gameOver?.finalScores ?? {};
  const losers = gameOver?.losers?.length ? gameOver.losers : gameOver?.loser ? [gameOver.loser] : [];
  const loserNames = losers.map((l) => l.name).join(' e ');
  const ranked = [...players].sort((a, b) => (finalScores[b.id] ?? 0) - (finalScores[a.id] ?? 0));

  return (
    <div className="screen screen--game-over">
      {revealed && (
        <>
          <div className="elimination-flash" aria-hidden="true" />
          <div className="confetti-layer" aria-hidden="true">
            {confetti.map((c) => (
              <span
                key={c.id}
                className="confetti-piece"
                style={{
                  left: `${c.left}%`,
                  animationDelay: `${c.delay}s`,
                  animationDuration: `${c.duration}s`,
                  '--drift': `${c.drift}px`,
                  fontSize: `${c.size}rem`,
                }}
              >
                {c.emoji}
              </span>
            ))}
          </div>
        </>
      )}

      <h2 className="subtitle">Fim de Jogo</h2>

      {!revealed ? (
        <div className="card suspense-card">
          <div className="queue-spinner" />
          <p className="queue-status">Apurando o resultado…</p>
        </div>
      ) : (
        <>
          <div className="card loser-card loser-card--impact">
            <span className="loser-label">Perdeu a partida</span>
            <strong className="loser-name">🤡 {loserNames || '???'} 🤡</strong>
            <p className="hint">chegou a 3 pontos negativos primeiro!</p>
          </div>

          <div className="card">
            <h3>Placar final</h3>
            <ul className="score-list">
              {ranked.map((p) => (
                <li key={p.id} className={p.eliminated ? 'is-eliminated' : ''}>
                  <span>{p.name}</span>
                  <span>{'✗'.repeat(finalScores[p.id] ?? p.score)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="form-actions">
            {mode === 'private' ? (
              isHost ? (
                <>
                  <button className="btn btn--primary" onClick={restartGame}>
                    Nova Partida
                  </button>
                  <button className="btn btn--ghost" onClick={goHome}>
                    Encerrar Sala
                  </button>
                </>
              ) : (
                <p className="hint">Aguardando o host…</p>
              )
            ) : (
              <>
                <button className="btn btn--primary" onClick={playAgain}>
                  Jogar Novamente
                </button>
                <button className="btn btn--ghost" onClick={goHome}>
                  Início
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
