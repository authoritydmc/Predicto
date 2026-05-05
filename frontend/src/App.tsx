import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import HomePage from './components/Pages/HomePage';
import TournamentPage from './components/Pages/TournamentPage';
import MatchPage from './components/Pages/MatchPage';
import OtherPredictionsPage from './components/Prediction/OtherPredictionsPage';
import TournamentLeaderboardPage from './components/Leaderboard/TournamentLeaderboardPage';
import './styles/App.css';
import './styles/match-page.css';

// Re-export context for backward compatibility
export { AppContext, useAppContext } from './context/AppContext';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/match/:matchCode" element={<MatchPage />} />
          <Route path="/tournament/:tournamentCode" element={<TournamentPage />} />
        </Route>
        <Route path="/tournament/:sport/:tournamentId/match/:matchId/predictions" element={<OtherPredictionsPage />} />
        <Route path="/match/:matchCode/predictions" element={<OtherPredictionsPage />} />
        <Route path="/tournament/:sport/:tournamentId/leaderboard" element={<TournamentLeaderboardPage />} />
        <Route path="/tournament/:tournamentCode/leaderboard" element={<TournamentLeaderboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
