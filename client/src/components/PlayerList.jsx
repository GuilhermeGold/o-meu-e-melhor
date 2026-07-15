export default function PlayerList({ players, selfId, hostId, onKick, showScores = false }) {
  return (
    <ul className="player-list">
      {players.map((p) => (
        <li key={p.id} className={`player-row ${p.eliminated ? 'is-eliminated' : ''}`}>
          <span className="player-name">
            {p.name}
            {p.id === selfId && <span className="player-tag">você</span>}
            {p.isHost && <span className="player-tag player-tag--host">host</span>}
            {p.connected === false && <span className="player-tag player-tag--warn">reconectando…</span>}
          </span>
          <span className="player-meta">
            {showScores && <span className="player-score">{'✗'.repeat(p.score)}</span>}
            {p.eliminated && <span className="player-tag player-tag--out">eliminado</span>}
            {onKick && p.id !== selfId && !p.eliminated && (
              <button className="btn-kick" onClick={() => onKick(p.id)} title="Expulsar jogador">
                remover
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
