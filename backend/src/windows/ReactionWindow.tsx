import React, { useState, useEffect } from 'react';
import { db, roomRef, onValue, isFirebaseConfigured, clearRoomNode } from '../firebase/db';

const ReactionWindow: React.FC = () => {
  const [roomId, setRoomId] = useState('ipl');
  const [reaction, setReaction] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // @ts-ignore
    window.overlayDesktop.getSettings().then((s: any) => {
      setRoomId(s.roomId || 'ipl');
    });

    // @ts-ignore
    window.overlayDesktop.onSettingsChanged((s: any) => {
      if (s.roomId) setRoomId(s.roomId);
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !roomId) return;

    const unsub = onValue(roomRef(roomId, 'reaction'), snap => {
      const data = snap.val();
      if (data && data.url) {
        setReaction(data);
        setVisible(true);
        // Clear after 6 seconds parity with source
        const timer = setTimeout(() => {
          setVisible(false);
          // Only clear if it's the same reaction we're showing
          clearRoomNode(roomId, 'reaction').catch(console.error);
        }, 6000);
        return () => clearTimeout(timer);
      } else {
        setVisible(false);
      }
    });

    return () => unsub();
  }, [roomId]);

  if (!reaction || !visible) return null;

  return (
    <div className="reaction-container" style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      overflow: 'hidden'
    }}>
      <div className="reaction-box" style={{
        animation: 'reaction-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.5))'
      }}>
        <img 
          src={reaction.url} 
          alt="Reaction" 
          style={{ 
            maxWidth: '80vw', 
            maxHeight: '80vh', 
            borderRadius: '24px',
            border: '8px solid white'
          }} 
        />
        {reaction.name && (
          <div style={{
            marginTop: 20,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px 30px',
            borderRadius: '40px',
            fontSize: 24,
            fontWeight: 800,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: 2,
            border: '2px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            {reaction.name} REACTION
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes reaction-pop {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          70% { transform: scale(1.1) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}} />
    </div>
  );
};

export default ReactionWindow;
