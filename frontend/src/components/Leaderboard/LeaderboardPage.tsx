import { useNavigate } from 'react-router-dom';
import TournamentLeaderboardModal from './TournamentLeaderboardModal';

export default function LeaderboardPage() {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="leaderboard-page-container">
      <TournamentLeaderboardModal
        sport="cricket"
        tournamentId="ipl26"
        onClose={handleClose}
      />
    </div>
  );
}
