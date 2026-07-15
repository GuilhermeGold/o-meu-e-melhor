import { useGameActions, useGameState } from '../context/GameContext.jsx';
import PlayerList from '../components/PlayerList.jsx';
import { CATEGORY_INFO } from '../constants.js';

export default function LobbyScreen() {
  const { roomCode, players, hostId, playerId, error, category } = useGameState();
  const { startGame, kickPlayer, goHome, clearError } = useGameActions();

  const isHost = hostId === playerId;
  const canStart = players.length >= 3;
  const categoryLabel = (CATEGORY_INFO[category] ?? CATEGORY_INFO.pessoa).pluralLabel;

  return (
    <div className="screen screen--lobby">
      <h2 className="subtitle">Sala Privada</h2>

      <div className="room-code-box">
        <span>Código da sala</span>
        <strong>{roomCode}</strong>
        <button
          className="btn btn--ghost btn--small"
          onClick={() => navigator.clipboard?.writeText(roomCode)}
        >
          copiar
        </button>
      </div>

      <p className="category-label">Categoria: {categoryLabel}</p>

      {error && (
        <p className="banner banner--error" onClick={clearError}>
          {error}
        </p>
      )}

      <div className="card">
        <h3>Jogadores ({players.length}/8)</h3>
        <PlayerList players={players} selfId={playerId} onKick={isHost ? kickPlayer : null} />
        {players.length < 3 && (
          <p className="hint">Aguardando pelo menos 3 jogadores para começar…</p>
        )}
      </div>

      <div className="form-actions">
        <button className="btn btn--ghost" onClick={goHome}>
          Sair
        </button>
        {isHost && (
          <button className="btn btn--primary" disabled={!canStart} onClick={startGame}>
            Iniciar Jogo
          </button>
        )}
        {!isHost && <p className="hint">Aguardando o host iniciar a partida…</p>}
      </div>
    </div>
  );
}
