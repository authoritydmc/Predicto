import React, { useState } from 'react';

interface MatchCreationFormProps {
  sport: string;
  matchTitle: string;
  teamA: string;
  teamB: string;
  matchStatus: 'live' | 'done' | 'scheduled';
  predictionsEnabled: boolean;
  predictionsPaused: boolean;
  pauseReason: string;
  allowReprediction: boolean;
  automationPaused: boolean;
  schedulerRunning: boolean;
  onSportChange: (sport: string) => void;
  onMatchTitleChange: (title: string) => void;
  onTeamAChange: (teamA: string) => void;
  onTeamBChange: (teamB: string) => void;
  onMatchStatusChange: (status: 'live' | 'done' | 'scheduled') => void;
  onPredictionsEnabledChange: (enabled: boolean) => void;
  onPredictionsPausedChange: (paused: boolean) => void;
  onPauseReasonChange: (reason: string) => void;
  onAllowRepredictionChange: (allowed: boolean) => void;
  onAutomationPausedChange: (paused: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
}

export const MatchCreationForm: React.FC<MatchCreationFormProps> = ({
  sport,
  matchTitle,
  teamA,
  teamB,
  matchStatus,
  predictionsEnabled,
  predictionsPaused,
  pauseReason,
  allowReprediction,
  automationPaused,
  schedulerRunning,
  onSportChange,
  onMatchTitleChange,
  onTeamAChange,
  onTeamBChange,
  onMatchStatusChange,
  onPredictionsEnabledChange,
  onPredictionsPausedChange,
  onPauseReasonChange,
  onAllowRepredictionChange,
  onAutomationPausedChange,
  onSubmit,
  disabled = false
}) => {
  return (
    <form onSubmit={onSubmit}>
      <div className="cp-form-row">
        <label>Sport</label>
        <select 
          value={sport} 
          onChange={e => onSportChange(e.target.value)}
          disabled={disabled}
        >
          <option value="cricket">Cricket</option>
          <option value="football">Football</option>
        </select>
      </div>
      <div className="cp-form-row">
        <label>Match Title</label>
        <input 
          type="text"
          value={matchTitle}
          onChange={e => onMatchTitleChange(e.target.value)}
          placeholder="Enter match title"
          required
          disabled={disabled}
        />
      </div>
      <div className="cp-dual-row">
        <div className="cp-form-row">
          <label>Team A</label>
          <input 
            type="text"
            value={teamA}
            onChange={e => onTeamAChange(e.target.value)}
            placeholder="Team A name"
            required
            disabled={disabled}
          />
        </div>
        <div className="cp-form-row">
          <label>Team B</label>
          <input 
            type="text"
            value={teamB}
            onChange={e => onTeamBChange(e.target.value)}
            placeholder="Team B name"
            required
            disabled={disabled}
          />
        </div>
      </div>
      <div className="cp-form-row">
        <label>Match Status</label>
        <select 
          value={matchStatus} 
          onChange={e => onMatchStatusChange(e.target.value as any)}
          disabled={disabled}
        >
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="done">Done</option>
        </select>
      </div>
      
      {/* Prediction Controls */}
      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Enable Predictions</span>
          <input 
            type="checkbox" 
            checked={predictionsEnabled}
            onChange={e => onPredictionsEnabledChange(e.target.checked)}
            disabled={disabled}
          />
        </label>
      </div>
      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Pause Predictions</span>
          <input 
            type="checkbox" 
            checked={predictionsPaused}
            onChange={e => onPredictionsPausedChange(e.target.checked)}
            disabled={disabled}
          />
        </label>
        {predictionsPaused && (
          <div className="cp-form-row">
            <label>Pause Reason</label>
            <input 
              type="text" 
              value={pauseReason}
              onChange={e => onPauseReasonChange(e.target.value)}
              placeholder="Enter reason for pausing predictions..."
              disabled={disabled}
            />
          </div>
        )}
      </div>
      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Allow Re-prediction</span>
          <input 
            type="checkbox" 
            checked={allowReprediction}
            onChange={e => onAllowRepredictionChange(e.target.checked)}
            disabled={disabled}
          />
        </label>
      </div>
      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Pause Automation</span>
          <input 
            type="checkbox" 
            checked={automationPaused}
            onChange={e => onAutomationPausedChange(e.target.checked)}
            disabled={disabled}
          />
        </label>
      </div>
      
      <button 
        className="cp-primary-btn cp-wide-btn" 
        type="submit"
        disabled={disabled}
        style={{ 
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        {disabled ? 'Match Already Created' : 'Create Match'}
      </button>
    </form>
  );
};
