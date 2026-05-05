import { useParams, useNavigate } from 'react-router-dom';
import TournamentBrowser from '../Tournament/TournamentBrowser';

export default function TournamentPage() {
  const { tournamentCode } = useParams();
  const navigate = useNavigate();

  if (!tournamentCode) return null;

  return (
    <main className="page">
      <TournamentBrowser
        tournamentCode={tournamentCode}
        onJoinMatch={(matchId) => navigate(`/match/${matchId}`)}
        onBack={() => navigate('/')}
      />
    </main>
  );
}
