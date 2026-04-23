import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { chatRef, matchChatRef, sendChatMessage, userRef } from '../../firebase/services';
import { onValue, query, limitToLast } from 'firebase/database';

interface ChatPanelProps {
  sport: string;
  id: string;
  matchId?: string;
  clientId: string;
}

export default function ChatPanel({ sport, id, matchId, clientId }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [userName, setUserName] = useState('Audience Member');
  const chatFeedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, [messages]);

  // Load User Profile
  useEffect(() => {
    return onValue(userRef(clientId), (snap) => {
      const data = snap.val();
      if (data?.name) setUserName(data.name);
    }, (error) => {
      console.error('[ChatPanel] Error fetching user profile:', error);
    });
  }, [clientId]);

  // Subscribe to Chat
  useEffect(() => {
    const chatRefToUse = matchId ? matchChatRef(sport, id, matchId) : chatRef(sport, id);
    const q = query(chatRefToUse, limitToLast(50));
    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.entries(data).map(([id, val]) => ({ id, ...(val as any) }));
        // Sort by timestamp if available, otherwise keep order
        msgs.sort((a, b) => {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          return timeA - timeB;
        });
        setMessages(msgs);
      } else {
        setMessages([]);
      }
    }, (error) => {
      console.error('[ChatPanel] Error fetching chat:', error);
    });

    return () => unsubscribe();
  }, [sport, id, matchId]);

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    // Handle Firebase timestamp object
    let timestampMs: number;
    if (typeof timestamp === 'object' && timestamp !== null) {
      timestampMs = timestamp.seconds ? timestamp.seconds * 1000 : Date.now();
    } else if (typeof timestamp === 'number') {
      timestampMs = timestamp;
    } else {
      return '';
    }
    
    const date = new Date(timestampMs);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older messages, show date
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const currentYear = now.getFullYear();
    
    if (year === currentYear) {
      return `on ${month} ${day}`;
    }
    return `on ${month} ${day}, ${year}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      try {
        await sendChatMessage(sport, id, {
          name: userName,
          message: message,
          clientId: clientId,
        }, matchId);
        setMessage('');
      } catch (error) {
        console.error('[ChatPanel] Error sending chat message:', error);
      }
    }
  };

  return (
    <section className="panel chat-panel">
      <div className="chat-header">
        <div className="chat-header-content">
          <h2>Live Chat</h2>
          <span className="chat-badge">{sport.toUpperCase()}</span>
        </div>
        <div className="chat-status">
          <span className="status-indicator"></span>
          <span className="status-text">{messages.length} online</span>
        </div>
      </div>

      <div className="chat-messages" ref={chatFeedRef}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`chat-row ${msg.clientId === clientId ? 'sent' : 'received'}`}
          >
            {msg.clientId !== clientId && (
              <div className="chat-avatar">
                {msg.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div className="chat-message-wrapper">
              {msg.clientId !== clientId && (
                <div className="chat-sender">
                  <span className="sender-name">{msg.name}</span>
                  <span className="message-time">{formatTimestamp(msg.timestamp)}</span>
                </div>
              )}
              <div className="chat-bubble">
                <p>{msg.message}</p>
              </div>
              {msg.clientId === clientId && (
                <div className="message-time sent-time">
                  {formatTimestamp(msg.timestamp)}
                </div>
              )}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="chat-placeholder">
            <div className="placeholder-icon">�</div>
            <p>No messages yet</p>
            <p className="placeholder-text">Start the conversation!</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-form">
        <div className="chat-form-wrapper">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
            placeholder="Message..."
            className="chat-form-input"
          />
          <button 
            type="submit" 
            className="chat-form-button"
            disabled={!message.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
