import { useEffect, useRef, useState } from 'react';
import { useGameActions, useGameState } from '../context/GameContext.jsx';
import { MAX_CHAT_LENGTH } from '../constants.js';

export default function ChatPanel() {
  const { chatMessages, playerId } = useGameState();
  const { sendChatMessage } = useGameActions();
  const [value, setValue] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chatMessages]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    sendChatMessage(trimmed);
    setValue('');
  }

  return (
    <div className="chat-widget">
      <div className="chat-panel">
        <div className="chat-panel-header">
          <span>Chat da sala</span>
        </div>
        <div className="chat-messages" ref={listRef}>
          {chatMessages.length === 0 && <p className="hint">Nenhuma mensagem ainda. Diga oi!</p>}
          {chatMessages.map((m) =>
            m.system ? (
              <p key={m.id} className="chat-system-message">
                {m.text}
              </p>
            ) : (
              <div key={m.id} className={`chat-message ${m.playerId === playerId ? 'is-own' : ''}`}>
                <span className="chat-message-author">{m.playerId === playerId ? 'Você' : m.playerName}</span>
                <span className="chat-message-text">{m.text}</span>
              </div>
            )
          )}
        </div>
        <form className="chat-input-row" onSubmit={handleSubmit}>
          <input
            value={value}
            maxLength={MAX_CHAT_LENGTH}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Digite uma mensagem…"
          />
          <button className="btn btn--primary btn--small" type="submit" disabled={!value.trim()}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
