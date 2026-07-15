import { useGameActions, useGameState } from '../context/GameContext.jsx';
import { CATEGORY_INFO } from '../constants.js';

export default function QueueScreen() {
  const { queueSize, countdown, error, category } = useGameState();
  const { leaveQueue, clearError } = useGameActions();
  const categoryLabel = (CATEGORY_INFO[category] ?? CATEGORY_INFO.pessoa).pluralLabel;

  return (
    <div className="screen screen--queue">
      <h2 className="subtitle">Fila de Matchmaking</h2>
      <p className="category-label">Categoria: {categoryLabel}</p>

      {error && (
        <p className="banner banner--error" onClick={clearError}>
          {error}
        </p>
      )}

      <div className="card queue-card">
        <div className="queue-spinner" />
        <p className="queue-status">Aguardando jogadores… {queueSize} na fila</p>

        {countdown != null ? (
          <p className="queue-countdown">A partida começa em {countdown}s</p>
        ) : queueSize >= 3 ? (
          <p className="hint">Contagem regressiva iniciando…</p>
        ) : (
          <p className="hint">Mínimo de 3 jogadores para iniciar a contagem</p>
        )}
      </div>

      <button className="btn btn--ghost" onClick={leaveQueue}>
        Sair da fila
      </button>
    </div>
  );
}
