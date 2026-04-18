import { useState, FormEvent, useEffect } from 'react';
import { chatRef, sendChatMessage } from '../../firebase/services';
import { onValue, query, limitToLast } from 'firebase/database';

export default function ChatPanel({ matchId }: { matchId: string }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const q = query(chatRef(matchId), limitToLast(30));
    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMessages(Object.entries(data).map(([id, val]) => ({ id, ...(val as any) })));
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [matchId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      await sendChatMessage(matchId, {
        name: "Audience Member", // Mock user identity until auth logic is added
        message: message,
        clientId: "temp-client",
      });
      setMessage('');
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Live Chat</p>
          <h2>Chat with the audience</h2>
        </div>
        <span className="status-pill neutral">Listening</span>
      </div>

      <form onSubmit={handleSubmit} className="chat-compose">
        <div className="chat-input-wrapper">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={1}
            maxLength={200}
            placeholder="Back your team here..."
            required
          />
          <div className="chat-actions">
            <button type="submit" className="send-btn" title="Send Message">
              <i className="fa-solid fa-paper-plane"></i> Send
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
        {messages.length === 0 && <div className="empty-state">No chat yet.</div>}
      </div>
    </section>
  );
}
