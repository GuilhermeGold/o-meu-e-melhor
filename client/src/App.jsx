import { useGameState } from './context/GameContext.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import LobbyScreen from './screens/LobbyScreen.jsx';
import QueueScreen from './screens/QueueScreen.jsx';
import ChoosingScreen from './screens/ChoosingScreen.jsx';
import VotingScreen from './screens/VotingScreen.jsx';
import ResultsScreen from './screens/ResultsScreen.jsx';
import GameOverScreen from './screens/GameOverScreen.jsx';

export default function App() {
  const { screen, phase } = useGameState();

  return (
    <div className="app-shell">
      {screen === 'home' && <HomeScreen />}
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'queue' && <QueueScreen />}
      {screen === 'game' && phase === 'choosing' && <ChoosingScreen />}
      {screen === 'game' && phase === 'voting' && <VotingScreen />}
      {screen === 'game' && phase === 'results' && <ResultsScreen />}
      {screen === 'game_over' && <GameOverScreen />}
    </div>
  );
}
