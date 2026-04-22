import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { chatRef, sendChatMessage, userRef } from '../../firebase/services';
import { onValue, query, limitToLast } from 'firebase/database';

interface ChatPanelProps {
  sport: string;
  id: string;
  clientId: string;
}

export default function ChatPanel({ sport, id, clientId }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [userName, setUserName] = useState('Audience Member');

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
    const q = query(chatRef(sport, id), limitToLast(30));
    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMessages(Object.entries(data).map(([id, val]) => ({ id, ...(val as any) })));
      } else {
        setMessages([]);
      }
    }, (error) => {
      console.error('[ChatPanel] Error fetching chat:', error);
    });

    return () => unsubscribe();
  }, [sport, id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      try {
        await sendChatMessage(sport, id, {
          name: userName,
          message: message,
          clientId: clientId,
        });
        setMessage('');
      } catch (error) {
        console.error('[ChatPanel] Error sending chat message:', error);
      }
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Live Chat • {sport.toUpperCase()}</p>
          <h2>Community Discussion</h2>
        </div>
        <span className="status-pill neutral">Active</span>
      </div>

      <form onSubmit={handleSubmit} className="chat-compose">
        <div className="chat-input-wrapper">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={1}
            maxLength={200}
            placeholder="Share your thoughts..."
            required
          />
          <div className="chat-actions">
            <button type="submit" className="send-btn" title="Send Message">
              Send
            </button>
          </div>
        </div>
      </form>

      <div className="chat-feed" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {messages.slice().reverse().map((msg) => (
          <article key={msg.id} className="chat-message audience-chat-message">
            <header><strong>{msg.name}</strong></header>
            <div className="chat-msg-content"><p>{msg.message}</p></div>
          </article>
        ))}
        {messages.length === 0 && <div className="empty-state">No chat yet. Start the conversation!</div>}
      </div>
    </section>
  );
}
