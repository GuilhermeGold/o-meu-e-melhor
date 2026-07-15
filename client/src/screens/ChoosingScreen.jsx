import { useEffect, useState } from 'react';
import Timer from '../components/Timer.jsx';
import { useGameActions, useGameState } from '../context/GameContext.jsx';
import { CHOOSING_TIME, CATEGORY_INFO } from '../constants.js';

export default function ChoosingScreen() {
  const {
    letter,
    timeLeft,
    confirmedCount,
    totalToConfirm,
    mySubmission,
    players,
    error,
    category,
    roundCategory,
  } = useGameState();
  const { submitName, clearError } = useGameActions();
  const [value, setValue] = useState('');
  const isMystery = category === 'misterio';
  const effectiveCategory = roundCategory || category;
  const { article, noun } = CATEGORY_INFO[effectiveCategory] ?? CATEGORY_INFO.pessoa;

  useEffect(() => {
    // Limpa o campo sempre que uma nova rodada começa (nova letra), mesmo
    // que a rodada anterior tenha esgotado o tempo sem confirmação.
    setValue('');
  }, [letter]);

  const total = totalToConfirm || players.length;

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim() || mySubmission) return;
    submitName(value.trim());
  }

  return (
    <div className="screen screen--choosing">
      <Timer seconds={timeLeft} total={CHOOSING_TIME} />

      <div className="letter-badge">{letter}</div>

      {isMystery && (
        <div className="category-badge">
          🎲 Categoria da rodada: <strong>{(CATEGORY_INFO[effectiveCategory] ?? CATEGORY_INFO.pessoa).label}</strong>
        </div>
      )}

      <p className="hint">
        Escolha {article} {noun} cujo nome comece com a letra acima.
      </p>

      {error && (
        <p className="banner banner--error" onClick={clearError}>
          {error}
        </p>
      )}

      {mySubmission ? (
        <div className="card confirmed-card">
          <p>Você escolheu:</p>
          <strong className="confirmed-name">{mySubmission}</strong>
          <p className="hint">Aguardando os outros jogadores…</p>
        </div>
      ) : (
        <form className="card form-card" onSubmit={handleSubmit}>
          <label className="field">
            <span>
              Nome de {article} {noun} com a letra "{letter}"
            </span>
            <input
              autoFocus
              maxLength={40}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Digite um nome…"
            />
          </label>
          <button className="btn btn--primary" type="submit" disabled={!value.trim()}>
            Confirmar
          </button>
        </form>
      )}

      <p className="confirmed-counter">
        {confirmedCount}/{total} confirmados
      </p>
    </div>
  );
}
