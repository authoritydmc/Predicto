import { useState } from 'react';

interface AudienceGateProps {
  onJoin: (code: string) => void;
}

export default function AudienceGate({ onJoin }: AudienceGateProps) {
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onJoin(code.trim().toLowerCase());
    }
  };

  return (
    <section className="panel audience-gate">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Join Match</p>
          <h2>Enter the match code</h2>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="stack-form">
        <label>
          Match code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={40}
            placeholder="e.g. ipl"
            required
          />
        </label>
        <button type="submit" className="primary-btn">Join audience room</button>
      </form>
    </section>
  );
}
