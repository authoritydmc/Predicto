import React, { useState } from 'react';

interface PredictionControlsProps {
  predictionsEnabled: boolean;
  predictionsPaused: boolean;
  pauseReason: string;
  allowReprediction: boolean;
  onTogglePredictions: (enabled: boolean) => void;
  onTogglePause: (paused: boolean) => void;
  onToggleReprediction: (allowed: boolean) => void;
  onUpdatePauseReason: (reason: string) => void;
}

export const PredictionControls: React.FC<PredictionControlsProps> = ({
  predictionsEnabled,
  predictionsPaused,
  pauseReason,
  allowReprediction,
  onTogglePredictions,
  onTogglePause,
  onToggleReprediction,
  onUpdatePauseReason
}) => {
  return (
    <div className="cp-section">
      <h3>Prediction Controls</h3>
      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Enable Predictions</span>
          <input 
            type="checkbox" 
            checked={predictionsEnabled}
            onChange={(e) => onTogglePredictions(e.target.checked)}
          />
        </label>
      </div>
      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Pause Predictions</span>
          <input 
            type="checkbox" 
            checked={predictionsPaused}
            onChange={(e) => onTogglePause(e.target.checked)}
          />
        </label>
        {predictionsPaused && (
          <div className="cp-form-row">
            <label>Pause Reason</label>
            <input 
              type="text" 
              value={pauseReason}
              onChange={(e) => onUpdatePauseReason(e.target.value)}
              placeholder="Enter reason for pausing predictions..."
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
            onChange={(e) => onToggleReprediction(e.target.checked)}
          />
        </label>
      </div>
    </div>
  );
};
