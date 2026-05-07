import React, { useState, useEffect, useMemo } from 'react';
import { db, matchMetaRef, matchPredictionsRef, onValue, isFirebaseConfigured, update } from '../firebase/db';
import { getTeamTheme } from '../utils/shared';
import { getTeamLogoUrl } from '../utils/teamLogos';
import '../styles/overlay-ticker.css';

const OverlayWindow: React.FC = () => {
  const [matchId, setMatchId] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [sport, setSport] = useState('');
  const [meta, setMeta] = useState<any>({});
  const [predictions, setPredictions] = useState<any>({});

  useEffect(() => {
    // @ts-ignore
    window.overlayDesktop.getSettings().then((s: any) => {
      if (s.matchId) setMatchId(s.matchId);
      if (s.tournamentId) setTournamentId(s.tournamentId);
      if (s.sport) setSport(s.sport);
    });

    // @ts-ignore
    window.overlayDesktop.onSettingsChanged((s: any) => {
      if (s.matchId) setMatchId(s.matchId);
      if (s.tournamentId) setTournamentId(s.tournamentId);
      if (s.sport) setSport(s.sport);
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId || !sport) return;

    const unsubMeta = onValue(matchMetaRef(sport, tournamentId, matchId), snap => setMeta(snap.val() || {}));
    const unsubPreds = onValue(matchPredictionsRef(sport, tournamentId, matchId), snap => setPredictions(snap.val() || {}));

    return () => {
      unsubMeta();
      unsubPreds();
    };
  }, [matchId, tournamentId, sport]);

  const teamA = meta.teamA || 'Team A';
  const teamB = meta.teamB || 'Team B';
  const theme = useMemo(() => getTeamTheme(teamA), [teamA]);

  const sortedPredictions = useMemo(() => {
    const list = Object.entries(predictions).map(([cid, p]: [string, any]) => ({ clientId: cid, ...p }));
    const sort = meta.predictionSort || 'newest';
    
    if (sort === 'score') {
      return list.sort((a, b) => {
        const valA = meta.secondInnings ? (meta.disableScoreA ? (a.scoreB || 0) : (a.scoreA || 0)) : (a.scoreA || a.scoreB || 0);
        const valB = meta.secondInnings ? (meta.disableScoreA ? (b.scoreB || 0) : (b.scoreA || b.scoreB || 0)) : (b.scoreA || b.scoreB || 0);
        return Number(valB) - Number(valA);
      });
    }
    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [predictions, meta]);

  const removePrediction = (cid: string) => {
    if (!confirm('Remove this prediction?')) return;
    update(matchPredictionsRef(sport, tournamentId, matchId), { [cid]: null }).catch(console.error);
  };

  if (meta.hideOverlay) return null;

  return (
    <div className="overlay-widget" style={{ 
      '--team-gradient': `linear-gradient(135deg, ${theme.primary} 0%, ${theme.alt} 100%)`,
      '--accent-blue': theme.primary
    } as any}>
      <div className="overlay-topbar">
        <div className="overlay-drag-handle" />
      </div>

      <main className="predictions-ribbon">
        <div className="overlay-ribbon-header">
           <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
             <span className="badge-mini" style={{ background: 'rgba(255,255,255,0.1)', fontSize: 9 }}>{sport.toUpperCase()}</span>
             <span>{meta.matchTitle || 'Live Predictions'}</span>
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
             {getTeamLogoUrl(teamA, '../desktop/assets/team-logos') && (
               <img 
                 src={getTeamLogoUrl(teamA, '../desktop/assets/team-logos')!} 
                 alt={teamA}
                 style={{ width: 24, height: 24, objectFit: 'contain' }}
               />
             )}
             <span className="team-badge" style={{ background: 'rgba(255,255,255,0.2)' }}>
               {meta.secondInnings ? '2nd Innings' : '1st Innings'}
             </span>
             {getTeamLogoUrl(teamB, '../desktop/assets/team-logos') && (
               <img 
                 src={getTeamLogoUrl(teamB, '../desktop/assets/team-logos')!} 
                 alt={teamB}
                 style={{ width: 24, height: 24, objectFit: 'contain' }}
               />
             )}
           </div>
        </div>

        {meta.showWinProb && (
          <div className="prediction-graph">
            <div className="graph-labels">
               <span style={{ color: '#fff', opacity: 0.8 }}>{teamA} {meta.winProbabilityA || 50}%</span>
               <span style={{ color: '#fff', opacity: 0.8 }}>{teamB} {meta.winProbabilityB || 50}%</span>
            </div>
            <div className="graph-track">
              <div 
                className="graph-fill" 
                style={{ 
                  width: `${meta.winProbabilityA || 50}%`,
                  background: 'rgba(255,255,255,0.3)'
                }} 
              />
            </div>
          </div>
        )}

        <div className="prediction-cards custom-scrollbar">
          {sortedPredictions.map((p) => {
            const isA = (p.predictedWinner || '').toLowerCase() === teamA.toLowerCase();
            const guess = meta.secondInnings 
              ? (meta.disableScoreA ? p.scoreB : p.scoreA) 
              : (isA ? p.scoreA : (p.scoreB || p.scoreA));
            
            return (
              <div key={p.clientId} className="prediction-card">
                <span className="prediction-name">{p.name || 'Anonymous'}</span>
                <span className="prediction-val">{guess || '---'} {meta.secondInnings && isA ? 'overs' : ''}</span>
                <span className="team-badge" style={{ 
                  background: isA ? 'rgba(0, 122, 255, 0.3)' : 'rgba(255, 59, 48, 0.3)',
                  color: '#fff'
                }}>
                  {isA ? (teamA.slice(0, 3)) : (teamB.slice(0, 3))}
                </span>
                <button className="overlay-admin-remove" onClick={() => removePrediction(p.clientId)}>×</button>
              </div>
            );
          })}
          {sortedPredictions.length === 0 && (
            <div className="p-4 text-center opacity-30 italic text-[11px]">Waiting for predictions...</div>
          )}
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}} />
    </div>
  );
};

export default OverlayWindow;
