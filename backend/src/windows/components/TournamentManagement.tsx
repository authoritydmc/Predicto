import React from 'react';

interface Tournament {
  tournamentId: string;
  tournamentName: string;
  status?: string;
}

interface TournamentManagementProps {
  availableTournaments: Tournament[];
  tournamentId: string;
  tournamentTab: string;
  fSport: string;
  fTournamentCode: string;
  fTournamentName: string;
  tournamentStatus: string;
  uploadingSchedule: boolean;
  schedule: any[];
  onSelectTournament: (t: Tournament) => void;
  onTabChange: (tab: string) => void;
  setFSport: (s: string) => void;
  setFTournamentCode: (c: string) => void;
  setFTournamentName: (n: string) => void;
  onUpdateTournamentStatus: (s: string) => void;
  onCreateTournament: () => void;
  onDeleteTournament: () => void;
  onCSVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadMatchFromSchedule: (match: any) => void;
  onEditSchedule: () => void;
  onClearSchedule: () => void;
}

export const TournamentManagement: React.FC<TournamentManagementProps> = ({
  availableTournaments,
  tournamentId,
  tournamentTab,
  fSport,
  fTournamentCode,
  fTournamentName,
  tournamentStatus,
  uploadingSchedule,
  schedule,
  onSelectTournament,
  onTabChange,
  setFSport,
  setFTournamentCode,
  setFTournamentName,
  onUpdateTournamentStatus,
  onCreateTournament,
  onDeleteTournament,
  onCSVUpload,
  onLoadMatchFromSchedule,
  onEditSchedule,
  onClearSchedule
}) => {
  return (
    <div className="cp-glass-card">
      <div style={{ 
        padding: '12px 16px', 
        background: 'rgba(99, 102, 241, 0.1)', 
        borderRadius: '8px', 
        border: '1px solid rgba(99, 102, 241, 0.2)', 
        marginBottom: '16px',
        fontSize: '12px',
        color: 'var(--muted)'
      }}>
        <strong>🏆 What this section does:</strong> Create tournaments, upload match schedules via CSV, and manage tournament status. Changes here update the tournament database and affect all associated matches.
      </div>
      {/* Sport Selection */}
      <div className="cp-form-row">
        <label>Sport Type *</label>
        <select value={fSport} onChange={e => setFSport(e.target.value)} required>
          <option value="">-- Select Sport --</option>
          <option value="cricket">Cricket</option>
          <option value="football">Football</option>
          <option value="basketball">Basketball</option>
          <option value="hockey">Hockey</option>
          <option value="tennis">Tennis</option>
        </select>
      </div>

      {/* Tournament List with Active Indicator */}
      {availableTournaments.length > 0 && (
        <div className="cp-form-row">
          <label>Available Tournaments</label>
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {availableTournaments.map((t) => (
              <div
                key={t.tournamentId}
                onClick={() => onSelectTournament(t)}
                style={{
                  padding: '12px',
                  background: tournamentId === t.tournamentId ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  border: tournamentId === t.tournamentId ? '1px solid var(--accent-blue)' : '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Active Indicator Green Dot */}
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: t.status === 'active' ? '#34C759' : t.status === 'paused' ? '#ff9f0a' : '#FF3B30',
                    boxShadow: t.status === 'active' ? '0 0 8px rgba(52, 199, 89, 0.6)' : 'none'
                  }} />
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text)' }}>{t.tournamentName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{t.tournamentId}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: '10px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: t.status === 'active' ? 'rgba(52, 199, 89, 0.2)' : t.status === 'paused' ? 'rgba(255, 159, 10, 0.2)' : 'rgba(255, 59, 48, 0.2)',
                  color: t.status === 'active' ? '#34C759' : t.status === 'paused' ? '#ff9f0a' : '#FF3B30',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  {t.status || 'active'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cp-divider" />

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => onTabChange('details')}
          className={`cp-action-btn cp-small ${tournamentTab === 'details' ? 'cp-active' : ''}`}
          style={{ flex: 1 }}
        >
          Tournament Details
        </button>
        <button
          type="button"
          onClick={() => onTabChange('schedule')}
          className={`cp-action-btn cp-small ${tournamentTab === 'schedule' ? 'cp-active' : ''}`}
          style={{ flex: 1 }}
        >
          Schedule Management
        </button>
      </div>

      {/* Tournament Details Tab */}
      {tournamentTab === 'details' && (
        <>
          <div className="cp-form-row">
            <label>Tournament Code</label>
            <input value={fTournamentCode} onChange={e => setFTournamentCode(e.target.value)} maxLength={40} placeholder="e.g. ipl-2024" />
          </div>
          <div className="cp-form-row">
            <label>Tournament Name</label>
            <input value={fTournamentName} onChange={e => setFTournamentName(e.target.value)} placeholder="e.g. IPL 2024" />
          </div>

          {/* Tournament Status */}
          {tournamentId && (
            <div className="cp-form-row">
              <label>Tournament Status</label>
              <div className="cp-radio-group">
                <div className="cp-radio-option">
                  <input type="radio" id="statusActive" name="tournamentStatus" value="active" checked={tournamentStatus === 'active'} onChange={() => onUpdateTournamentStatus('active')} />
                  <label className="cp-radio-label" htmlFor="statusActive">Active</label>
                </div>
                <div className="cp-radio-option">
                  <input type="radio" id="statusPaused" name="tournamentStatus" value="paused" checked={tournamentStatus === 'paused'} onChange={() => onUpdateTournamentStatus('paused')} />
                  <label className="cp-radio-label" htmlFor="statusPaused">Paused</label>
                </div>
                <div className="cp-radio-option">
                  <input type="radio" id="statusEnded" name="tournamentStatus" value="ended" checked={tournamentStatus === 'ended'} onChange={() => onUpdateTournamentStatus('ended')} />
                  <label className="cp-radio-label" htmlFor="statusEnded">Ended</label>
                </div>
              </div>
            </div>
          )}

          <div className="cp-divider" />

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="cp-primary-btn" style={{ flex: 1 }} type="button" onClick={onCreateTournament}>
              {tournamentId ? 'Update Tournament' : 'Create Tournament'}
            </button>
            {tournamentId && (
              <button 
                className="cp-secondary-btn cp-danger" 
                type="button"
                onClick={onDeleteTournament}
                style={{ flex: '0 0 auto' }}
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}

      {/* Schedule Management Tab */}
      {tournamentTab === 'schedule' && (
        <>
          {!tournamentId && (
            <div style={{ padding: '16px', background: 'rgba(255, 159, 10, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 159, 10, 0.3)', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', color: '#ff9f0a', fontWeight: '600' }}>
                ⚠️ Please select a tournament first to manage its schedule
              </span>
            </div>
          )}

          {tournamentId && (
            <>
              <div className="cp-form-row">
                <label>Upload Schedule (CSV)</label>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={onCSVUpload}
                  disabled={uploadingSchedule}
                />
                {uploadingSchedule && <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Parsing CSV...</span>}
              </div>

              <div className="cp-divider" />

              <div className="cp-form-row">
                <label>Current Schedule ({schedule.length} matches)</label>
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {schedule.length === 0 ? (
                    <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', textAlign: 'center', color: 'var(--muted)' }}>
                      No matches in schedule. Upload CSV or click Edit to add matches manually.
                    </div>
                  ) : (
                    schedule.map((match, idx) => (
                      <div 
                        key={idx}
                        style={{ 
                          padding: '10px', 
                          background: 'rgba(255,255,255,0.05)', 
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          fontSize: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text)' }}>{match.matchTitle}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{match.teamA} vs {match.teamB}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{match.date || 'TBD'} • {match.venue || ''}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onLoadMatchFromSchedule(match)}
                          className="cp-action-btn cp-small"
                          style={{ fontSize: '10px', padding: '4px 8px' }}
                        >
                          Load
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="cp-divider" />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button"
                  onClick={onEditSchedule}
                  className="cp-primary-btn"
                  style={{ flex: 1 }}
                >
                  Edit Schedule
                </button>
                <button 
                  type="button"
                  onClick={onClearSchedule}
                  className="cp-secondary-btn cp-danger"
                  style={{ flex: '0 0 auto' }}
                >
                  Clear
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
