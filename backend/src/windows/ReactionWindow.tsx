import React, { useState, useEffect } from 'react';
import { onValue, roomActiveMatchRef, matchReactionRef } from '../firebase/db';

const ReactionWindow: React.FC = () => {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [reaction, setReaction] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rId = params.get('room') || 'ipl';
    onValue(roomActiveMatchRef(rId), (snap) => setActiveMatchId(snap.val()));
  }, []);

  useEffect(() => {
    if (!activeMatchId) return;
    onValue(matchReactionRef(activeMatchId), (snap) => {
      const data = snap.val();
      if (data) {
        setReaction(data);
        setTimeout(() => setReaction(null), 5000);
      }
    });
  }, [activeMatchId]);

  return (
    <div className="h-full w-full relative group">
      {/* Draggable Area - only visible on hover to indicate movement possibility */}
      <div className="absolute inset-0 border-2 border-dashed border-white/0 group-hover:border-white/20 rounded-3xl transition-all pointer-events-none"></div>
      <div 
        style={{ WebkitAppRegion: 'drag' } as any}
        className="absolute top-0 left-0 w-full h-8 cursor-grab flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
         <div className="w-10 h-1 bg-white/20 rounded-full"></div>
      </div>

      {reaction && (
        <div className="h-full w-full flex items-center justify-center p-4">
           <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in duration-500 text-center">
              {reaction.mediaUrl && (
                <img src={reaction.mediaUrl} className="max-w-[200px] max-h-[150px] mx-auto rounded-xl mb-3 shadow-lg" alt="reaction" />
              )}
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{reaction.name}</div>
              <div className="text-xs text-white/80 mt-1">{reaction.type === 'image' ? 'Sent a sticker!' : 'Reacted!'}</div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ReactionWindow;
