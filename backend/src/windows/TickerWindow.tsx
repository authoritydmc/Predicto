import React, { useState, useEffect, useMemo } from 'react';
import { db, legacyMatchMetaRef, legacyMatchPredictionsRef, legacyMatchChatRef, onValue, isFirebaseConfigured, query, limitToLast } from '../firebase/db';
import { getTeamTheme } from '../utils/shared';
import '../styles/overlay-ticker.css';

const MESSAGE_EXPIRY = 60000;

const TickerWindow: React.FC = () => {
  const [roomId, setRoomId] = useState('ipl');
  const [sport, setSport] = useState('cricket');
  const [meta, setMeta] = useState<any>({});
  const [predictions, setPredictions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // @ts-ignore
    window.overlayDesktop.getSettings().then((s: any) => {
      if (s.roomId) setRoomId(s.roomId);
      if (s.sport) setSport(s.sport);
    });

    // @ts-ignore
    window.overlayDesktop.onSettingsChanged((s: any) => {
      if (s.roomId) setRoomId(s.roomId);
      if (s.sport) setSport(s.sport);
    });

    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !roomId) return;

    const unsubMeta = onValue(legacyMatchMetaRef(sport, roomId), snap => setMeta(snap.val() || {}));
    const unsubPreds = onValue(legacyMatchPredictionsRef(sport, roomId), snap => {
      const data = snap.val() || {};
      setPredictions(Object.entries(data).map(([id, p]: [string, any]) => ({ id, ...p })));
    });

    const chatQuery = query(legacyMatchChatRef(sport, roomId), limitToLast(15));
    const unsubChat = onValue(chatQuery, snap => {
      const data = snap.val() || {};
      setMessages(Object.entries(data).map(([id, m]: [string, any]) => ({ id, ...m })));
    });

    return () => {
      unsubMeta();
      unsubPreds();
      unsubChat();
    };
  }, [roomId, sport]);

  const theme = useMemo(() => getTeamTheme(meta.teamA), [meta.teamA]);

  const stats = useMemo(() => {
    if (!predictions.length) return { pA: 50, pB: 50 };
    const tA = (meta.teamA || '').toLowerCase().trim();
    const countA = predictions.filter(p => (p.predictedWinner || '').toLowerCase().trim() === tA).length;
    const pA = Math.round((countA / predictions.length) * 100);
    return { pA, pB: 100 - pA };
  }, [predictions, meta]);

  const tickerItems = useMemo(() => {
    const items: React.ReactNode[] = [];
    const validMsgs = messages.filter(m => (now - (m.createdAt || 0)) < MESSAGE_EXPIRY);

    // 1. Fan Guesses
    if (predictions.length > 0) {
      const is2nd = meta.secondInnings;
      const tA = meta.teamA || 'Home';
      const tB = meta.teamB || 'Away';
      const chaser = meta.disableScoreA ? tB : (meta.disableScoreB ? tA : null);

      const fanStrs = predictions.map(p => {
        const win = (p.predictedWinner || '').toString().trim();
        const isA = win.toLowerCase() === tA.toLowerCase();
        const isChaser = chaser && win.toLowerCase() === chaser.toLowerCase();
        
        let score = isA ? p.scoreA : (p.scoreB || p.scoreA);
        const suffix = (is2nd && isChaser && sport === 'cricket') ? ' ov' : '';
        if (is2nd && isChaser && sport === 'cricket') score = Number(score || 0).toFixed(1);

        return `${p.name} (${win}): ${score}${suffix}`;
      });

      items.push(
        <span key="fans" className="ticker-item">
          <span className="ticker-badge" style={{ background: theme.primary }}>Fan Guesses</span>
          <span className="ticker-msg">{fanStrs.join(' | ')}</span>
        </span>
      );
    }

    // 2. Chat Messages
    validMsgs.forEach(m => {
      if (m.message && (m.message.includes('klipy.co') || m.message.includes('klipy.com')) && !m.mediaUrl) return;
      
      items.push(
        <span key={m.id} className="ticker-item">
          <span className="ticker-badge" style={{ background: theme.alt }}>Chat</span>
          <span className="ticker-msg"><strong>{m.name}:</strong> {m.message}</span>
          {m.mediaUrl && <img src={m.mediaUrl} style={{ height: 18, borderRadius: 4, marginLeft: 6 }} alt="" />}
        </span>
      );
    });

    if (items.length === 0) {
      items.push(
        <span key="empty" className="ticker-item">
          <span className="ticker-badge">Live</span>
          <span className="ticker-msg">{meta.matchTitle || 'OverlayChat'} is live! Waiting for predictions...</span>
        </span>
      );
    }

    return items;
  }, [predictions, messages, meta, now, theme, sport]);

  const duration = useMemo(() => {
    const rawText = tickerItems.map(i => (i as any).key).join(' ');
    return Math.max(25, (tickerItems.length * 15));
  }, [tickerItems]);

  if (meta.hideTicker) return null;

  return (
    <div className="ticker-wrapper" style={{ 
      '--team-gradient': `linear-gradient(90deg, ${theme.primary} 0%, ${theme.alt} 100%)`,
      '--ticker-duration': `${duration}s`
    } as any}>
      <div className="ticker-static">
        {meta.teamA ? (
          <span style={{ color: '#fff' }}>
            {meta.teamA} {stats.pA}% vs {stats.pB}% {meta.teamB}
          </span>
        ) : (
          <span>OverlayChat Live</span>
        )}
      </div>
      <div className="ticker-track">
        {tickerItems.map((item, i) => (
          <React.Fragment key={i}>
            {item}
            <span className="ticker-sep">•</span>
          </React.Fragment>
        ))}
        {/* Duplicate for seamless loop */}
        {tickerItems.map((item, i) => (
          <React.Fragment key={`dup-${i}`}>
            {item}
            <span className="ticker-sep">•</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default TickerWindow;
