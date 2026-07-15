import { useState } from 'react';
import { useGameActions, useGameState } from '../context/GameContext.jsx';
import { CATEGORIES } from '../constants.js';

export default function HomeScreen() {
  const { error, wasKicked } = useGameState();
  const { createRoom, joinRoom, joinQueue, clearError } = useGameActions();

  const [mode, setMode] = useState(null); // null | 'create' | 'join' | 'public'
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [category, setCategory] = useState('pessoa');

  const nameValid = playerName.trim().length >= 2;
  const needsCategory = mode === 'create' || mode === 'public';

  function handleCreate() {
    if (!nameValid) return;
    createRoom(playerName.trim(), category);
  }
  function handleJoin() {
    if (!nameValid || roomCode.trim().length !== 4) return;
    joinRoom(roomCode, playerName.trim());
  }
  function handlePublic() {
    if (!nameValid) return;
    joinQueue(playerName.trim(), category);
  }

  return (
    <div className="screen screen--home">
      <h1 className="title">O Meu é Melhor</h1>

      <p className="callout">
        Na categoria <strong>Pessoa</strong>, pode ser qualquer pessoa — famosa ou não, real ou
        fictícia. Na categoria <strong>Objeto</strong>, vale qualquer objeto. No modo{' '}
        <strong>Mistério</strong>, a categoria muda a cada rodada entre pessoa, objeto, comida,
        verbo e lugar. O critério é dos jogadores da sala. <strong>Criatividade</strong> deve ser
        considerada na hora da votação!
      </p>

      {wasKicked && <p className="banner banner--warn">Você foi removido da sala pelo host.</p>}
      {error && (
        <p className="banner banner--error" onClick={clearError}>
          {error}
        </p>
      )}

      {mode === null && (
        <div className="mode-select">
          <button className="btn btn--primary" onClick={() => setMode('create')}>
            Criar Sala
          </button>
          <button className="btn btn--secondary" onClick={() => setMode('join')}>
            Entrar com Código
          </button>
          <button className="btn btn--accent" onClick={() => setMode('public')}>
            Jogar Online
          </button>
        </div>
      )}

      {mode !== null && (
        <div className="card form-card">
          <label className="field">
            <span>Seu nome</span>
            <input
              autoFocus
              maxLength={20}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Como te chamam?"
            />
          </label>

          {mode === 'join' && (
            <label className="field">
              <span>Código da sala</span>
              <input
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                className="code-input"
              />
            </label>
          )}

          {needsCategory && (
            <div className="field">
              <span>Categoria</span>
              <div className="category-select">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`category-option ${category === c.value ? 'is-selected' : ''}`}
                    onClick={() => setCategory(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn--ghost" onClick={() => setMode(null)}>
              Voltar
            </button>
            {mode === 'create' && (
              <button className="btn btn--primary" disabled={!nameValid} onClick={handleCreate}>
                Criar Sala
              </button>
            )}
            {mode === 'join' && (
              <button
                className="btn btn--primary"
                disabled={!nameValid || roomCode.trim().length !== 4}
                onClick={handleJoin}
              >
                Entrar
              </button>
            )}
            {mode === 'public' && (
              <button className="btn btn--primary" disabled={!nameValid} onClick={handlePublic}>
                Jogar Online
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rules-summary">
        <p>3–8 jogadores · 3 pontos negativos elimina · 60s para escolher · 30s para votar</p>
      </div>

      <div className="card rules-card">
        <h3>Como jogar</h3>
        <ol className="rules-list">
          <li>
            Cada rodada sorteia uma letra. Todos os jogadores têm 60s para pensar em algo que
            comece com essa letra, conforme a categoria da sala (no modo Mistério, sorteada de
            novo a cada rodada entre pessoa, objeto, comida, verbo e lugar).
          </li>
          <li>
            Quando todos confirmam (ou o tempo acaba), começa a votação: 30s para escolher a pior
            opção entre os nomes enviados. Não é possível votar no próprio nome, e quem não
            confirmou um nome fica de fora da votação.
          </li>
          <li>O(s) nome(s) mais votado(s) rende(m) um ponto negativo ao(s) jogador(es) que o(s) escolheu(ram).</li>
          <li>Ao atingir 3 pontos negativos, o jogador perde a partida e o jogo termina.</li>
        </ol>
      </div>
    </div>
  );
}
