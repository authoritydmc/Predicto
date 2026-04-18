import React, { useState, useEffect } from 'react';
import { onValue, matchMetaRef, matchPredictionsRef, roomActiveMatchRef } from '../firebase/db';

const OverlayWindow: React.FC = () => {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>({});
  const [predictions, setPredictions] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rId = params.get('room') || 'ipl';
    onValue(roomActiveMatchRef(rId), (snap) => setActiveMatchId(snap.val()));
  }, []);

  useEffect(() => {
    if (!activeMatchId) return;
    onValue(matchMetaRef(activeMatchId), (snap) => setMeta(snap.val() || {}));
    onValue(matchPredictionsRef(activeMatchId), (snap) => {
      const data = snap.val() || {};
      // Sort predictions by score gap or custom logic if needed
      setPredictions(Object.values(data));
    });
  }, [activeMatchId]);

  const percA = meta.winProbabilityA || 50;

  return (
    <div className="prediction-overlay">
      
      {/* Probability Header */}
      <section className="overlay-header">
         <div className="live-pill">
            <span className="live-dot"></span>
            <span className="live-text">Live Predictions</span>
            <span className="live-count">{predictions.length} live</span>
         </div>
         
         <div className="prob-container">
            <div className="team-score team-a">
               <div className="team-logo">RCB</div>
               <div className="team-meta">
                  <span className="team-name">{meta.teamA || 'RCB'}</span>
                  <span className="team-perc">{percA}%</span>
               </div>
            </div>
            
            <div className="prob-bar-wrapper">
               <div className="prob-bar">
                  <div style={{ width: `${percA}%` }} className="prob-progress prob-a"></div>
                  <div style={{ width: `${100-percA}%` }} className="prob-progress prob-b"></div>
               </div>
            </div>

            <div className="team-score team-b">
               <div className="team-meta">
                  <span className="team-name">{meta.teamB || 'DC'}</span>
                  <span className="team-perc">{100-percA}%</span>
               </div>
               <div className="team-logo">DC</div>
            </div>
         </div>
      </section>

      {/* Leaderboard List */}
      <main className="leaderboard-list scroll-hide">
         {predictions.map((p, i) => (
            <div key={i} className="leaderboard-item animate-slide-in" style={{ animationDelay: `${i * 100}ms` }}>
               <div className="item-rank">{i + 1}</div>
               <div className="item-name">{p.name || 'Anup'}</div>
               <div className="item-pred">
                  <span className="pred-val">{p.scoreA || p.scoreB || '208'}</span>
                  <div className={`pred-team-badge ${p.predictedWinner === 'a' ? 'bg-a' : 'bg-b'}`}>
                     {p.predictedWinner === 'a' ? (meta.teamA || 'RCB') : (meta.teamB || 'DC')}
                  </div>
               </div>
            </div>
         ))}
      </main>

    </div>
  );
};

export default OverlayWindow;
