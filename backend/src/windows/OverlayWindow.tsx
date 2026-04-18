import React, { useState, useEffect } from 'react';
import { db, getDbRoot, onValue, matchMetaRef, matchPredictionsRef, matchChatRef, roomActiveMatchRef } from '../firebase/db';

const OverlayWindow: React.FC = () => {
  const [roomId, setRoomId] = useState('ipl');
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>({});
  const [predictions, setPredictions] = useState<any[]>([]);
  const [chat, setChat] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rId = params.get('room') || 'ipl';
    setRoomId(rId);

    // 1. Sync Active Match
    const unsubMatch = onValue(roomActiveMatchRef(rId), (snap) => {
      setActiveMatchId(snap.val());
    });

    return () => unsubMatch();
  }, []);

  useEffect(() => {
    if (!activeMatchId) return;

    // 2. Sync Meta
    const unsubMeta = onValue(matchMetaRef(activeMatchId), (snap) => {
      setMeta(snap.val() || {});
    });

    // 3. Sync Predictions
    const unsubPreds = onValue(matchPredictionsRef(activeMatchId), (snap) => {
      const data = snap.val() || {};
      setPredictions(Object.entries(data).map(([id, val]: any) => ({ clientId: id, ...val })));
    });

    // 4. Sync Chat
    const unsubChat = onValue(matchChatRef(activeMatchId), (snap) => {
      const data = snap.val() || {};
      setChat(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
    });

    return () => {
      unsubMeta();
      unsubPreds();
      unsubChat();
    };
  }, [activeMatchId]);

  // Graph Logic
  const teamA = meta.teamA || 'Team A';
  const teamB = meta.teamB || 'Team B';
  const countA = predictions.filter(p => p.predictedWinner === teamA).length;
  const countB = predictions.filter(p => p.predictedWinner === teamB).length;
  const total = countA + countB;
  const percentA = total > 0 ? Math.round((countA / total) * 100) : 50;
  const percentB = 100 - percentA;

  return (
    <div className="p-4 h-screen flex flex-col justify-end pointer-events-none">
       <div className="w-[400px] bg-slate-900/90 rounded-3xl border border-white/10 p-6 backdrop-blur-xl pointer-events-auto space-y-6 shadow-2xl">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">Live Prediction</h2>
             </div>
             <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/40">{predictions.length} Users</span>
          </div>

          {/* Graph */}
          <div className="space-y-3">
             <div className="flex justify-between text-xs font-bold px-1">
                <span>{teamA}</span>
                <span className="text-white/40">{percentA}% / {percentB}%</span>
                <span>{teamB}</span>
             </div>
             <div className="h-4 bg-white/5 rounded-full overflow-hidden flex p-0.5">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${percentA}%` }}
                ></div>
             </div>
          </div>

          {/* Mini Chat Feed */}
          <div className="space-y-3">
             <h3 className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Recent Chat</h3>
             <div className="space-y-2 max-h-[120px] overflow-hidden">
                {chat.slice(-3).reverse().map((msg, i) => (
                  <div key={msg.id} className="text-xs flex gap-2 animate-in fade-in slide-in-from-left-2">
                     <strong className="text-indigo-300 shrink-0">{msg.name}</strong>
                     <span className="text-white/60 truncate">{msg.message}</span>
                  </div>
                ))}
             </div>
          </div>
       </div>
    </div>
  );
};

export default OverlayWindow;
