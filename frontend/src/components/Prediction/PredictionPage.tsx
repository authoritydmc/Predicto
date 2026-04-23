import { useParams, useNavigate } from 'react-router-dom';
import PredictionPanel from './PredictionPanel';
import { useAppContext } from '../../App';

export default function PredictionPage() {
  const { matchCode } = useParams<{ matchCode: string }>();
  const navigate = useNavigate();
  const appContext = useAppContext();

  const handleBack = () => {
    if (matchCode) {
      navigate(`/match/${matchCode}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="prediction-page-container">
      <div className="prediction-page-header">
        <button className="back-btn" onClick={handleBack}>← Back to Match</button>
        <h1>Predictions</h1>
      </div>
      <div className="prediction-page-content">
        {matchCode && (
          <PredictionPanel
            sport="cricket"
            id="ipl26"
            matchId={matchCode}
            clientId={appContext.clientId}
          />
        )}
      </div>
    </div>
  );
}
