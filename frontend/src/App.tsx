import { useState, useEffect } from 'react';
import { onValue } from 'firebase/database';
import { activeMatchRef, roomConfigRef } from './firebase/services';
import AudienceGate from './components/Gate/AudienceGate';
import ChatPanel from './components/Chat/ChatPanel';
import PredictionPanel from './components/Prediction/PredictionPanel';
import FavoriteTeamModal from './components/TeamSelection/FavoriteTeamModal';
import './styles/App.css';

function App() {
  const [matchCode, setMatchCode] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<string | null>(null);
  const [sportType, setSportType] = useState<string>('generic');
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);

  useEffect(() => {
    if (!matchCode) return;
    const unsubMatch = onValue(activeMatchRef(matchCode), (snap) => setActiveMatch(snap.val()));
    const unsubConf = onValue(roomConfigRef(matchCode), (snap) => {
      const conf = snap.val();
      if (conf?.sportType) setSportType(conf.sportType);
    });

    return () => { unsubMatch(); unsubConf(); };
  }, [matchCode]);

  if (!matchCode) {
    return <AudienceGate onJoin={(code) => setMatchCode(code)} />;
  }

  return (
    <main className="page page-audience">
      {!favoriteTeam && (
        <FavoriteTeamModal onSelectTeam={(team) => setFavoriteTeam(team)} />
      )}
      
      <div id="audienceApp" className="audience-app-container">
        <section className="hero audience-hero audience-hero-compact">
          <div className="hero-meta">
            <span>Room: <strong id="roomBadge">{matchCode}</strong></span>
            <span id="matchBadge">{activeMatch ? `Active Match: ${activeMatch}` : 'Waiting for match setup...'}</span>
          </div>
        </section>

        {favoriteTeam && (
          <section className="panel favorite-team-panel">
            <div className="favorite-team-display">
              <div className="favorite-team-info">
                <p className="favorite-team-label">Your Favorite Team</p>
                <h3 className="favorite-team-name">{favoriteTeam}</h3>
                <button onClick={() => setFavoriteTeam(null)} className="ghost-link-xs">
                  Change Team
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="grid-two">
          {activeMatch ? (
            <>
               <PredictionPanel matchId={activeMatch} sportType={sportType} />
               <ChatPanel matchId={activeMatch} />
            </>
          ) : (
            <div className="panel"><p>Match not started. Please tell the host to create a match.</p></div>
          )}
        </div>
      </div>
    </main>
  );
}

export default App;
