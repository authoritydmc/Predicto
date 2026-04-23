import { useState, useEffect, useRef, useMemo } from 'react';
import type { FormEvent } from 'react';
import { chatRef, matchChatRef, sendChatMessage, userRef, saveUserGlobalProfile } from '../../firebase/services';
import { onValue, query, limitToLast, get } from 'firebase/database';
import './ChatPanel.css';

interface ChatMessage {
  id: string;
  name: string;
  message: string;
  clientId: string;
  timestamp: number | { seconds: number; nanoseconds?: number };
}

interface ChatPanelProps {
  sport: string;
  id: string;
  matchId?: string;
  clientId: string;
}

// Generate consistent avatar color based on username
const getAvatarColor = (name: string): string => {
  const colors = [
    '#8b5cf6', // violet
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#6366f1', // indigo
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

// Get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function ChatPanel({ sport, id, matchId, clientId }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userName, setUserName] = useState('You');
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTo({
        top: chatFeedRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // Load User Profile - check localStorage first, then Firebase
  useEffect(() => {
    // First, try to get from localStorage immediately
    const storedUsername = localStorage.getItem('ovr_username');
    if (storedUsername) {
      setUserName(storedUsername);
      console.log('[ChatPanel] Username from localStorage:', storedUsername);
    }

    // Then sync with Firebase
    const loadUserProfile = async () => {
      try {
        const snap = await get(userRef(clientId));
        const data = snap.val();
        console.log('[ChatPanel] Firebase user profile:', data);
        
        if (data?.username) {
          setUserName(data.username);
        } else if (data?.name) {
          setUserName(data.name);
        } else if (storedUsername) {
          // If no username in Firebase but we have it in localStorage, save it
          await saveUserGlobalProfile(clientId, { username: storedUsername });
          console.log('[ChatPanel] Saved username to Firebase:', storedUsername);
        }
      } catch (error) {
        console.error('[ChatPanel] Error loading user profile:', error);
      }
    };

    loadUserProfile();

    // Also subscribe for real-time updates
    const unsubscribe = onValue(userRef(clientId), (snap) => {
      const data = snap.val();
      if (data?.username) {
        setUserName(data.username);
      } else if (data?.name) {
        setUserName(data.name);
      }
    }, (error) => {
      console.error('[ChatPanel] Error in user profile subscription:', error);
    });

    return () => unsubscribe();
  }, [clientId]);

  // Subscribe to Chat
  useEffect(() => {
    const chatRefToUse = matchId ? matchChatRef(sport, id, matchId) : chatRef(sport, id);
    const q = query(chatRefToUse, limitToLast(100));
    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.entries(data).map(([id, val]) => ({ id, ...(val as any) }));
        // Sort by timestamp
        msgs.sort((a, b) => {
          const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
          const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
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

  const formatTimestamp = useMemo(() => {
    return (timestamp: any): string => {
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
        return `${month} ${day}`;
      }
      return `${month} ${day}, ${year}`;
    };
  }, []);

  // Format time for detailed display (hover)
  const formatDetailedTime = (timestamp: any): string => {
    if (!timestamp) return '';
    
    let timestampMs: number;
    if (typeof timestamp === 'object' && timestamp !== null) {
      timestampMs = timestamp.seconds ? timestamp.seconds * 1000 : Date.now();
    } else if (typeof timestamp === 'number') {
      timestampMs = timestamp;
    } else {
      return '';
    }
    
    const date = new Date(timestampMs);
    return date.toLocaleString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      await sendChatMessage(sport, id, {
        name: userName,
        message: message.trim(),
        clientId: clientId,
      }, matchId);
      setMessage('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('[ChatPanel] Error sending chat message:', error);
    }
  };

  // Get unique participants count
  const uniqueParticipants = useMemo(() => {
    const unique = new Set(messages.map(m => m.clientId));
    return unique.size;
  }, [messages]);

  return (
    <section className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-icon-wrapper">
            <svg className="chat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div className="chat-status-dot"></div>
          </div>
          <div className="chat-header-info">
            <h2 className="chat-title">Live Chat</h2>
            <div className="chat-header-meta">
              <span className="chat-sport">{sport.toUpperCase()}</span>
              <span className="chat-separator">•</span>
              <span className="chat-participants">{uniqueParticipants} active</span>
            </div>
          </div>
        </div>
        <div className="chat-header-right">
          <div className="chat-avatars">
            {messages.slice(-3).reverse().map((msg, idx) => (
              <div 
                key={msg.id} 
                className="chat-avatar-mini"
                style={{ 
                  backgroundColor: getAvatarColor(msg.name),
                  zIndex: 3 - idx 
                }}
                title={msg.name}
              >
                {getInitials(msg.name)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={chatFeedRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="chat-empty-title">No messages yet</p>
            <p className="chat-empty-subtitle">Be the first to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwnMessage = msg.clientId === clientId;
            const showAvatar = !isOwnMessage;
            const isFirstInGroup = index === 0 || messages[index - 1].clientId !== msg.clientId;

            return (
              <div 
                key={msg.id} 
                className={`chat-message-row ${isOwnMessage ? 'chat-message-own' : 'chat-message-other'}`}
              >
                {/* Avatar */}
                {showAvatar && isFirstInGroup && (
                  <div 
                    className="chat-avatar"
                    style={{ backgroundColor: getAvatarColor(msg.name) }}
                    title={msg.name}
                  >
                    {getInitials(msg.name)}
                  </div>
                )}
                {showAvatar && !isFirstInGroup && <div className="chat-avatar-spacer" />}

                {/* Message Content */}
                <div className={`chat-message-content ${isOwnMessage ? 'chat-message-content-own' : 'chat-message-content-other'}`}>
                  {/* Sender Name - Only show for others and on first message in group */}
                  {!isOwnMessage && isFirstInGroup && (
                    <span className="chat-sender-name">
                      {msg.name}
                    </span>
                  )}

                  {/* Message Bubble */}
                  <div 
                    className={`chat-bubble ${isOwnMessage ? 'chat-bubble-own' : 'chat-bubble-other'}`}
                    title={formatDetailedTime(msg.timestamp)}
                  >
                    <p className="chat-message-text">
                      {msg.message}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <span className="chat-timestamp">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <form onSubmit={handleSubmit} className="chat-form">
          <div className="chat-input-wrapper">
            <div className="chat-input-container">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                placeholder={`Message as ${userName}...`}
                className="chat-input"
              />
              <span className={`chat-char-count ${message.length > 0 ? 'chat-char-count-visible' : ''}`}>
                {message.length}/500
              </span>
            </div>
            <button 
              type="submit" 
              disabled={!message.trim()}
              className={`chat-send-btn ${message.trim() ? 'chat-send-btn-active' : 'chat-send-btn-disabled'}`}
            >
              <svg className="chat-send-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
