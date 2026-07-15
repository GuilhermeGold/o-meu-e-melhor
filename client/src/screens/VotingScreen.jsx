import Timer from '../components/Timer.jsx';
import { useGameActions, useGameState } from '../context/GameContext.jsx';
import { VOTING_TIME } from '../constants.js';

export default function VotingScreen() {
  const { votingNames, myVote, mySubmission, timeLeft, error } = useGameState();
  const { vote, clearError } = useGameActions();

  const didNotSubmit = mySubmission === null;

  return (
    <div className="screen screen--voting">
      <p className="vote-prompt">Vote na pior opção!</p>
      <Timer seconds={timeLeft} total={VOTING_TIME} />
      <h2 className="subtitle">Qual foi a pior escolha?</h2>

      {error && (
        <p className="banner banner--error" onClick={clearError}>
          {error}
        </p>
      )}

      {didNotSubmit && (
        <p className="banner banner--warn">
          Você não confirmou um nome nesta rodada e por isso não participa da votação.
        </p>
      )}

      <ul className="vote-list">
        {votingNames.map((name) => {
          const isOwn = name === mySubmission;
          const isSelected = name === myVote;
          return (
            <li key={name}>
              <button
                className={`vote-option ${isSelected ? 'is-selected' : ''} ${isOwn ? 'is-own' : ''}`}
                disabled={isOwn || didNotSubmit || !!myVote}
                onClick={() => vote(name)}
              >
                {name}
                {isOwn && <span className="player-tag">seu nome</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {myVote && <p className="hint">Voto registrado em "{myVote}". Aguardando os demais…</p>}
    </div>
  );
}
