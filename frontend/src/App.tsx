import { useState, useEffect } from 'react';
import { onValue } from 'firebase/database';
import { discoveryRef, metaRef } from './firebase/services';
import AudienceGate from './components/Gate/AudienceGate';
import ChatPanel from './components/Chat/ChatPanel';
import PredictionPanel from './components/Prediction/PredictionPanel';
import FavoriteTeamModal from './components/TeamSelection/FavoriteTeamModal';
import { getTeamLogoUrl } from './utils/teamLogos';
import './styles/App.css';

function App() {
  const [matchCode, setMatchCode] = useState<string | null>(null);
  const [tournamentContext, setTournamentContext] = useState<{sport: string, id: string} | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientId] = useState(() => {
    const existing = localStorage.getItem('ovr_client_id');
    if (existing) return existing;
    const next = 'c-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('ovr_client_id', next);
    return next;
  });

  // 1. Resolve Tournament Context from Room Code
  useEffect(() => {
    if (!matchCode) return;
    setLoading(true);
    const unsub = onValue(discoveryRef(matchCode), (snap) => {
      const data = snap.val();
      if (data && data.sport && data.tournamentId) {
        setTournamentContext({ sport: data.sport, id: data.tournamentId });
      } else {
        console.error('[App] Tournament not found or not active for room:', matchCode);
        alert('Tournament not found or not active. Check the code.');
        setMatchCode(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('[App] Error fetching discovery for room:', matchCode, error);
      setLoading(false);
    });
    return () => unsub();
  }, [matchCode]);

  // 2. Subscribe to Tournament Meta
  useEffect(() => {
    if (!tournamentContext) return;
    const { sport, id } = tournamentContext;
    const unsubMatch = onValue(metaRef(sport, id), (snap) => {
      setMeta(snap.val());
    }, (error) => {
      console.error('[App] Error fetching tournament meta:', { sport, id }, error);
    });
    return () => unsubMatch();
  }, [tournamentContext]);

  if (!matchCode) {
    return <AudienceGate onJoin={(code) => setMatchCode(code)} />;
  }

  if (loading || !tournamentContext) {
    return <main className="page"><div className="panel"><p>Connecting to {matchCode.toUpperCase()}...</p></div></main>;
  }

  const activeMatch = meta?.matchTitle;

  return (
    <main className="page page-audience">
      {!favoriteTeam && (
        <FavoriteTeamModal onSelectTeam={(team) => setFavoriteTeam(team)} />
      )}
      
      <div id="audienceApp" className="audience-app-container">
        <section className="hero audience-hero audience-hero-compact">
          <div className="hero-meta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <span className="badge-mini" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                 {tournamentContext.sport.toUpperCase()}
               </span>
               <span>Room: <strong id="roomBadge">{matchCode}</strong></span>
            </div>
            <span id="matchBadge">{activeMatch ? `Active: ${activeMatch}` : 'Waiting for host...'}</span>
          </div>
        </section>

        {favoriteTeam && (
          <section className="panel favorite-team-panel">
            <div className="favorite-team-display">
              {getTeamLogoUrl(favoriteTeam) && (
                <img 
                  src={getTeamLogoUrl(favoriteTeam)!} 
                  alt={favoriteTeam}
                  className="favorite-team-logo"
                />
              )}
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
               <PredictionPanel 
                 sport={tournamentContext.sport} 
                 id={tournamentContext.id} 
                 clientId={clientId}
               />
               <ChatPanel 
                 sport={tournamentContext.sport} 
                 id={tournamentContext.id} 
                 clientId={clientId}
               />
            </>
          ) : (
            <div className="panel"><p>Match setup in progress. Please wait...</p></div>
          )}
        </div>
      </div>
    </main>
  );
}

export default App;
