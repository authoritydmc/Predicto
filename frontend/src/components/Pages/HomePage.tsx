import { useNavigate } from 'react-router-dom';
import AudienceGate from '../Gate/AudienceGate';

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <main className="page">
      <AudienceGate
        onJoinMatch={(code) => navigate(`/match/${code}`)}
        onJoinTournament={(code) => navigate(`/tournament/${code}`)}
      />
    </main>
  );
}
