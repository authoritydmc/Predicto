import React, { useState, useEffect } from 'react';
import { onValue, matchChatRef, roomActiveMatchRef, matchMetaRef } from '../firebase/db';

const TickerWindow: React.FC = () => {
  const [roomId, setRoomId] = useState('ipl');
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rId = params.get('room') || 'ipl';
    setRoomId(rId);

    const unsubMatch = onValue(roomActiveMatchRef(rId), (snap) => setActiveMatchId(snap.val()));
    return () => unsubMatch();
  }, []);

  useEffect(() => {
    if (!activeMatchId) return;

    const unsubMeta = onValue(matchMetaRef(activeMatchId), (snap) => setMeta(snap.val() || {}));
    const unsubChat = onValue(matchChatRef(activeMatchId), (snap) => {
      const data = snap.val() || {};
      setMessages(Object.values(data).slice(-10));
    });

    return () => { unsubMeta(); unsubChat(); };
  }, [activeMatchId]);

  return (
    <div className="h-full bg-slate-900 border-t-2 border-indigo-500 overflow-hidden flex items-center">
      <div className="bg-indigo-600 text-white px-4 h-full flex items-center font-black animate-pulse uppercase tracking-tighter">
        LATEST
      </div>
      <div className="flex-1 px-4 overflow-hidden relative">
        <div className="flex gap-24 whitespace-nowrap animate-marquee">
          {messages.length > 0 ? messages.map((m, i) => (
             <div key={i} className="flex gap-2">
                <span className="text-indigo-400 font-bold">{m.name}:</span>
                <span className="text-slate-200">{m.message}</span>
             </div>
          )) : (
             <span className="text-slate-500 italic">Waiting for incoming messages... Room: {roomId}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TickerWindow;
