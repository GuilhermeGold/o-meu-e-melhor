import Timer from '../components/Timer.jsx';
import { useGameActions, useGameState } from '../context/GameContext.jsx';
import { RESULTS_TIME, REACTIONS } from '../constants.js';

// Posição horizontal estável derivada do id da reação, pra não "pular" a
// cada re-render enquanto a animação está rolando.
function hashToPercent(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 10 + (hash % 80); // mantém entre 10% e 90% da largura
}

export default function ResultsScreen() {
  const { roundResults, players, timeLeft, reactions } = useGameState();
  const { sendReaction } = useGameActions();

  if (!roundResults) {
    return (
      <div className="screen screen--results">
        <p className="hint">Apurando votos…</p>
      </div>
    );
  }

  const { votes, losers, nameAuthors, scores } = roundResults;
  const maxVotes = Math.max(1, ...Object.values(votes));
  const entries = Object.entries(votes).sort((a, b) => b[1] - a[1]);

  function playerNameOf(id) {
    return players.find((p) => p.id === id)?.name ?? '???';
  }

  return (
    <div className="screen screen--results">
      <div className="reaction-layer" aria-hidden="true">
        {reactions.map((r) => (
          <span
            key={r.id}
            className="reaction-float"
            style={{ left: `${hashToPercent(r.id)}%` }}
          >
            <span className="reaction-float-emoji">{r.emoji}</span>
            <span className="reaction-float-name">{r.playerName}</span>
          </span>
        ))}
      </div>

      <h2 className="subtitle">Resultado da rodada</h2>
      <Timer seconds={timeLeft} total={RESULTS_TIME} />

      <div className="card results-card">
        {entries.map(([name, count]) => {
          const isLoser = losers.includes(name);
          const authors = (nameAuthors?.[name] ?? []).map(playerNameOf).join(', ');
          return (
            <div key={name} className={`vote-bar-row ${isLoser ? 'is-loser' : ''}`}>
              <div className="vote-bar-header">
                <span className="vote-bar-name">
                  {name}
                  {isLoser && <span className="player-tag player-tag--out">pior escolha</span>}
                </span>
                <span className="vote-bar-count">{count} voto(s)</span>
              </div>
              <div className="vote-bar-track">
                <div
                  className={`vote-bar-fill ${isLoser ? 'is-loser' : ''}`}
                  style={{ width: `${(count / maxVotes) * 100}%` }}
                />
              </div>
              {authors && <span className="vote-bar-author">escolhido por: {authors}</span>}
            </div>
          );
        })}
        {entries.length === 0 && <p className="hint">Ninguém confirmou um nome válido para votação.</p>}
      </div>

      <div className="card">
        <h3>Placar</h3>
        <ul className="score-list">
          {[...players]
            .sort((a, b) => a.score - b.score)
            .map((p) => (
              <li key={p.id} className={p.eliminated ? 'is-eliminated' : ''}>
                <span>{p.name}</span>
                <span>{'✗'.repeat(p.score)}</span>
              </li>
            ))}
        </ul>
      </div>

      <div className="reaction-bar">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="reaction-btn"
            onClick={() => sendReaction(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <p className="hint">Próxima rodada em breve…</p>
    </div>
  );
}
