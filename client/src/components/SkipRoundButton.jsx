import { useGameActions, useGameState } from '../context/GameContext.jsx';

export default function SkipRoundButton() {
  const { mode, hostId, playerId } = useGameState();
  const { skipRound } = useGameActions();

  if (mode !== 'private' || hostId !== playerId) return null;

  return (
    <button type="button" className="btn-skip-round" onClick={skipRound} title="Pular esta rodada">
      ⏭ Pular rodada
    </button>
  );
}
