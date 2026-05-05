import React, { useState, useEffect } from 'react';
import { update, matchMetaRef } from '../../firebase/db';

interface MatchControlPanelProps {
  // Match Info
  fSport: string;
  fTeamA: string;
  fTeamB: string;
  matchId: string;
  tournamentId: string;
  
  // Scraper State
  scraperRunning: boolean;
  scraperStatus: string;
  scraperOrder: string;
  scraperMatchUrl: string;
  onRunScraper: () => void;
  onUpdateScraperOrder: (order: string) => void;
  onUpdateScraperUrl: (url: string) => void;
  
  // Score State
  scoreSource: 'scraper' | 'manual' | 'api' | 'prediction';
  onScoreSourceChange: (source: 'scraper' | 'manual' | 'api' | 'prediction') => void;
  
  // Manual Score Controls
  scoreTeamARuns: string;
  scoreTeamAWickets: string;
  scoreTeamAOvers: string;
  scoreTeamBRuns: string;
  scoreTeamBWickets: string;
  scoreTeamBOvers: string;
  setScoreTeamARuns: (value: string) => void;
  setScoreTeamAWickets: (value: string) => void;
  setScoreTeamAOvers: (value: string) => void;
  setScoreTeamBRuns: (value: string) => void;
  setScoreTeamBWickets: (value: string) => void;
  setScoreTeamBOvers: (value: string) => void;
  
  // Match Status
  fMatchStatus: 'scheduled' | 'live' | 'done';
  setFMatchStatus: (status: 'scheduled' | 'live' | 'done') => void;
  
  // Cricket-specific
  fBattingTeam: 'teamA' | 'teamB';
  fInnings: '1' | '2';
  fTossWinner: 'teamA' | 'teamB' | null;
  fTossDecision: 'bat' | 'bowl' | null;
  setFBattingTeam: (value: 'teamA' | 'teamB') => void;
  setFInnings: (value: '1' | '2') => void;
  setFTossWinner: (value: 'teamA' | 'teamB' | null) => void;
  setFTossDecision: (value: 'bat' | 'bowl' | null) => void;
  
  // Prediction Controls
  fPredictionsEnabled: boolean;
  fPredictionsPaused: boolean;
  fPauseReason: string;
  fAllowReprediction: boolean;
  onTogglePredictions: (enabled: boolean) => void;
  onTogglePause: (paused: boolean) => void;
  onToggleReprediction: (allowed: boolean) => void;
  onUpdatePauseReason: (reason: string) => void;
  
  // Actions
  onUpdateLiveScore: () => void;
}

type DataSourceMode = 'scraper' | 'manual' | 'api' | 'prediction';
type ActiveTab = 'data' | 'predictions' | 'match-status';

export const MatchControlPanel: React.FC<MatchControlPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('data');
  const [showManualOverride, setShowManualOverride] = useState(false);
  
  // Determine current mode based on scoreSource prop
  // 'scraper' is the only automated mode, everything else is considered manual
  const isScraperMode = props.scoreSource === 'scraper';
  const currentMode: DataSourceMode = props.scoreSource;
  
  const handleModeSwitch = (mode: DataSourceMode) => {
    props.onScoreSourceChange(mode);
    if (mode === 'scraper') {
      setShowManualOverride(false);
    }
  };
  
  // Check if any manual override is active (values differ from what scraper would set)
  const hasManualOverrides = !isScraperMode;
  
  const battingTeamName = props.fBattingTeam === 'teamA' ? props.fTeamA : props.fTeamB;
  const bowlingTeamName = props.fBattingTeam === 'teamA' ? props.fTeamB : props.fTeamA;
  
  const battingScore = props.fBattingTeam === 'teamA' 
    ? { runs: props.scoreTeamARuns, wickets: props.scoreTeamAWickets, overs: props.scoreTeamAOvers }
    : { runs: props.scoreTeamBRuns, wickets: props.scoreTeamBWickets, overs: props.scoreTeamBOvers };
    
  const bowlingScore = props.fBattingTeam === 'teamA'
    ? { runs: props.scoreTeamBRuns, wickets: props.scoreTeamBWickets, overs: props.scoreTeamBOvers }
    : { runs: props.scoreTeamARuns, wickets: props.scoreTeamAWickets, overs: props.scoreTeamAOvers };

  return (
    <div className="match-control-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Primary Data Source Selection */}
      <div className="data-source-selector" style={{
        padding: '16px',
        background: 'rgba(99, 102, 241, 0.08)',
        borderRadius: '12px',
        border: '1px solid rgba(99, 102, 241, 0.2)',
      }}>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: '600', 
          color: 'var(--muted)', 
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '12px'
        }}>
          Data Source Mode
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleModeSwitch('scraper')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '10px',
              border: currentMode === 'scraper' ? '2px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
              background: currentMode === 'scraper' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: '16px' }}>🤖</span>
            <span>Scraper (Auto)</span>
            {currentMode === 'scraper' && (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#34c759',
                marginLeft: '4px'
              }} />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('manual')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '10px',
              border: currentMode === 'manual' ? '2px solid #ff9f0a' : '1px solid rgba(255,255,255,0.1)',
              background: currentMode === 'manual' ? 'rgba(255, 159, 10, 0.2)' : 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: '16px' }}>✏️</span>
            <span>Manual</span>
            {currentMode === 'manual' && (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ff9f0a',
                marginLeft: '4px'
              }} />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('api')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '10px',
              border: currentMode === 'api' ? '2px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
              background: currentMode === 'api' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: '16px' }}>📊</span>
            <span>API</span>
            {currentMode === 'api' && (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#34c759',
                marginLeft: '4px'
              }} />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('prediction')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '10px',
              border: currentMode === 'prediction' ? '2px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
              background: currentMode === 'prediction' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: '16px' }}>🤔</span>
            <span>Prediction</span>
            {currentMode === 'prediction' && (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#34c759',
                marginLeft: '4px'
              }} />
            )}
          </button>
        </div>
        <p style={{
          margin: '12px 0 0 0',
          fontSize: '11px',
          color: 'var(--muted)',
          lineHeight: '1.5'
        }}>
          {isScraperMode 
            ? '🤖 Scraper mode automatically fetches match data (score, toss, batting info) from external sources.'
            : `✏️ Manual mode (${props.scoreSource === 'manual' ? 'manual entry' : props.scoreSource === 'api' ? 'external API' : 'prediction fallback'}). You control all match details.`}
        </p>
      </div>

      {/* Sub-tabs for organization */}
      <div style={{ 
        display: 'flex', 
        gap: '4px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: '8px'
      }}>
        {[
          { id: 'data', label: 'Match Data', icon: '📊' },
          { id: 'predictions', label: 'Predictions', icon: '🎯' },
          { id: 'match-status', label: 'Status', icon: '🚦' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--muted)',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? '600' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* MATCH DATA TAB */}
      {activeTab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* SCRAPER CONTROLS */}
          {isScraperMode && (
            <div style={{
              padding: '16px',
              background: 'rgba(52, 199, 89, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(52, 199, 89, 0.2)',
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '18px' }}>🤖</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#34c759' }}>
                  Scraper Controls
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ 
                    fontSize: '11px', 
                    color: 'var(--muted)', 
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    Match URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={props.scraperMatchUrl}
                    onChange={(e) => props.onUpdateScraperUrl(e.target.value)}
                    placeholder="https://www.cricbuzz.com/live-cricket-scores/..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      fontSize: '13px',
                    }}
                  />
                  <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: 'var(--muted)' }}>
                    Leave empty for auto-search, or paste direct Cricbuzz/ESPNcricinfo URL
                  </p>
                </div>
                
                <div>
                  <label style={{ 
                    fontSize: '11px', 
                    color: 'var(--muted)', 
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    Scraper Priority Order
                  </label>
                  <input
                    type="text"
                    value={props.scraperOrder}
                    onChange={(e) => props.onUpdateScraperOrder(e.target.value)}
                    placeholder="cricbuzz,google,cricapi"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      fontSize: '13px',
                    }}
                  />
                </div>
                
                <button
                  type="button"
                  onClick={props.onRunScraper}
                  disabled={props.scraperRunning}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: props.scraperRunning ? 'rgba(255,255,255,0.1)' : '#34c759',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: props.scraperRunning ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>{props.scraperRunning ? '⏳' : '🔄'}</span>
                  <span>{props.scraperRunning ? 'Running Scraper...' : 'Run Scraper Now'}</span>
                </button>
                
                {props.scraperStatus && (
                  <p style={{ 
                    margin: '4px 0 0 0', 
                    fontSize: '12px',
                    color: props.scraperStatus.includes('Success') ? '#34c759' : 
                           props.scraperStatus.includes('Failed') ? '#ef4444' : 'var(--muted)'
                  }}>
                    {props.scraperStatus}
                  </p>
                )}
                
                {/* Manual Override Toggle in Scraper Mode */}
                <div style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'rgba(255, 159, 10, 0.05)',
                  borderRadius: '8px',
                  border: '1px dashed rgba(255, 159, 10, 0.3)',
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#fff',
                  }}>
                    <input
                      type="checkbox"
                      checked={showManualOverride}
                      onChange={(e) => setShowManualOverride(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>🛠️ Show Manual Override Panel</span>
                  </label>
                  <p style={{ margin: '6px 0 0 24px', fontSize: '10px', color: 'var(--muted)' }}>
                    Temporarily override scraper data for specific fields
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* MANUAL CONTROLS - Show in manual mode OR when override is enabled in scraper mode */}
          {(!isScraperMode || showManualOverride) && (
            <div style={{
              padding: '16px',
              background: !isScraperMode ? 'rgba(255, 159, 10, 0.05)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: !isScraperMode ? '1px solid rgba(255, 159, 10, 0.2)' : '1px dashed rgba(255, 255, 255, 0.1)',
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '18px' }}>{!isScraperMode ? '✏️' : '🛠️'}</span>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: '700', 
                  color: !isScraperMode ? '#ff9f0a' : 'var(--muted)'
                }}>
                  {!isScraperMode ? 'Manual Controls' : 'Manual Override'}
                </span>
              </div>
              
              {props.fSport === 'cricket' && (
                <>
                  {/* Cricket-specific Match Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Innings & Batting */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                          Current Innings
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(['1', '2'] as const).map((inn) => (
                            <button
                              key={inn}
                              type="button"
                              onClick={() => props.setFInnings(inn)}
                              style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '6px',
                                border: props.fInnings === inn ? '1px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                                background: props.fInnings === inn ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: props.fInnings === inn ? '600' : '400',
                                cursor: 'pointer',
                              }}
                            >
                              {inn}st
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                          Batting Team
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {[
                            { key: 'teamA', label: props.fTeamA || 'Team A' },
                            { key: 'teamB', label: props.fTeamB || 'Team B' },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => props.setFBattingTeam(key as 'teamA' | 'teamB')}
                              style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '6px',
                                border: props.fBattingTeam === key ? '1px solid #34c759' : '1px solid rgba(255,255,255,0.1)',
                                background: props.fBattingTeam === key ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: props.fBattingTeam === key ? '600' : '400',
                                cursor: 'pointer',
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Score Inputs */}
                    <div style={{
                      padding: '14px',
                      background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.1) 0%, rgba(52, 199, 89, 0.02) 100%)',
                      borderRadius: '10px',
                      border: '1px solid rgba(52, 199, 89, 0.2)',
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#34c759', marginBottom: '10px' }}>
                        🏏 {battingTeamName} (Batting)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Runs</label>
                          <input
                            type="number"
                            value={battingScore.runs}
                            onChange={(e) => {
                              if (props.fBattingTeam === 'teamA') props.setScoreTeamARuns(e.target.value);
                              else props.setScoreTeamBRuns(e.target.value);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.15)',
                              background: 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              fontSize: '15px',
                              fontWeight: '700',
                              textAlign: 'center',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Wickets</label>
                          <input
                            type="number"
                            value={battingScore.wickets}
                            onChange={(e) => {
                              if (props.fBattingTeam === 'teamA') props.setScoreTeamAWickets(e.target.value);
                              else props.setScoreTeamBWickets(e.target.value);
                            }}
                            max="10"
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.15)',
                              background: 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              fontSize: '15px',
                              fontWeight: '700',
                              textAlign: 'center',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Overs</label>
                          <input
                            type="number"
                            step="0.1"
                            value={battingScore.overs}
                            onChange={(e) => {
                              if (props.fBattingTeam === 'teamA') props.setScoreTeamAOvers(e.target.value);
                              else props.setScoreTeamBOvers(e.target.value);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.15)',
                              background: 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              fontSize: '15px',
                              fontWeight: '700',
                              textAlign: 'center',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Bowling Team (Compact) */}
                    <div style={{
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '8px' }}>
                        🎯 {bowlingTeamName} (Bowling)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Runs</label>
                          <input
                            type="number"
                            value={bowlingScore.runs}
                            onChange={(e) => {
                              if (props.fBattingTeam === 'teamA') props.setScoreTeamBRuns(e.target.value);
                              else props.setScoreTeamARuns(e.target.value);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: 'rgba(255,255,255,0.05)',
                              color: '#fff',
                              fontSize: '14px',
                              textAlign: 'center',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Wickets</label>
                          <input
                            type="number"
                            value={bowlingScore.wickets}
                            onChange={(e) => {
                              if (props.fBattingTeam === 'teamA') props.setScoreTeamBWickets(e.target.value);
                              else props.setScoreTeamAWickets(e.target.value);
                            }}
                            max="10"
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: 'rgba(255,255,255,0.05)',
                              color: '#fff',
                              fontSize: '14px',
                              textAlign: 'center',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Overs</label>
                          <input
                            type="number"
                            step="0.1"
                            value={bowlingScore.overs}
                            onChange={(e) => {
                              if (props.fBattingTeam === 'teamA') props.setScoreTeamBOvers(e.target.value);
                              else props.setScoreTeamAOvers(e.target.value);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: 'rgba(255,255,255,0.05)',
                              color: '#fff',
                              fontSize: '14px',
                              textAlign: 'center',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Toss Info */}
                    <details>
                      <summary style={{ 
                        fontSize: '12px', 
                        color: 'var(--muted)', 
                        cursor: 'pointer',
                        padding: '8px 0'
                      }}>
                        🪙 Toss Information
                      </summary>
                      <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                            Toss Winner
                          </label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {[
                              { key: 'teamA', label: props.fTeamA || 'A' },
                              { key: 'teamB', label: props.fTeamB || 'B' },
                            ].map(({ key, label }) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => props.setFTossWinner(key as 'teamA' | 'teamB')}
                                style={{
                                  flex: 1,
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: props.fTossWinner === key ? '1px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                                  background: props.fTossWinner === key ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                                  color: '#fff',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                            Decision
                          </label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {[
                              { key: 'bat', label: 'Bat' },
                              { key: 'bowl', label: 'Bowl' },
                            ].map(({ key, label }) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => props.setFTossDecision(key as 'bat' | 'bowl')}
                                style={{
                                  flex: 1,
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: props.fTossDecision === key ? '1px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                                  background: props.fTossDecision === key ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                                  color: '#fff',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </>
              )}
              
              {props.fSport === 'football' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                      {props.fTeamA} Goals
                    </label>
                    <input
                      type="number"
                      value={props.scoreTeamARuns}
                      onChange={(e) => props.setScoreTeamARuns(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.08)',
                        color: '#fff',
                        fontSize: '16px',
                        fontWeight: '700',
                        textAlign: 'center',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                      {props.fTeamB} Goals
                    </label>
                    <input
                      type="number"
                      value={props.scoreTeamBRuns}
                      onChange={(e) => props.setScoreTeamBRuns(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.08)',
                        color: '#fff',
                        fontSize: '16px',
                        fontWeight: '700',
                        textAlign: 'center',
                      }}
                    />
                  </div>
                </div>
              )}
              
              {/* Save Button for Manual Mode */}
              {!isScraperMode && (
                <button
                  type="button"
                  onClick={props.onUpdateLiveScore}
                  style={{
                    marginTop: '8px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ff9f0a',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  💾 Update Live Score
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* PREDICTIONS TAB */}
      {activeTab === 'predictions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            padding: '12px 16px',
            background: props.fPredictionsEnabled ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
            borderRadius: '10px',
            border: `1px solid ${props.fPredictionsEnabled ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '20px' }}>{props.fPredictionsEnabled ? '🟢' : '🔴'}</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                Predictions {props.fPredictionsEnabled ? 'Enabled' : 'Disabled'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {props.fPredictionsEnabled ? 'Users can submit predictions' : 'Predictions are closed'}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}>
              <span style={{ fontSize: '14px' }}>Enable Predictions</span>
              <input
                type="checkbox"
                checked={props.fPredictionsEnabled}
                onChange={(e) => props.onTogglePredictions(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
            
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: props.fPredictionsPaused ? 'rgba(255, 159, 10, 0.1)' : 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              cursor: 'pointer',
              border: props.fPredictionsPaused ? '1px solid rgba(255, 159, 10, 0.3)' : 'none',
            }}>
              <div>
                <span style={{ fontSize: '14px', display: 'block' }}>Pause Predictions</span>
                {props.fPredictionsPaused && (
                  <span style={{ fontSize: '11px', color: '#ff9f0a' }}>Currently paused</span>
                )}
              </div>
              <input
                type="checkbox"
                checked={props.fPredictionsPaused}
                onChange={(e) => {
                  console.log('[MatchControlPanel] Pause checkbox clicked:', e.target.checked);
                  console.log('[MatchControlPanel] Current fPredictionsPaused:', props.fPredictionsPaused);
                  props.onTogglePause(e.target.checked);
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
            
            {props.fPredictionsPaused && (
              <div style={{ padding: '0 12px' }}>
                <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                  Pause Reason (shown to users)
                </label>
                <input
                  type="text"
                  value={props.fPauseReason}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--muted)',
                    fontSize: '11px'
                  }}
                />
              </div>
            )}
            
            {showPauseReasonDialog && (
              <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999
              }}>
                <div style={{
                  backgroundColor: 'var(--panel-bg)',
                  padding: '24px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  minWidth: '400px',
                  maxWidth: '500px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                  maxHeight: '80vh',
                  overflowY: 'auto'
                }}>
                  {/* Pause Reason Dialog content */}
                </div>
              </div>
            )}
            
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}>
              <span style={{ fontSize: '14px' }}>Allow Re-prediction</span>
              <input
                type="checkbox"
                checked={props.fAllowReprediction}
                onChange={(e) => props.onToggleReprediction(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
          </div>
          
          <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'var(--muted)', lineHeight: '1.5' }}>
            💡 Changes take effect immediately. Users will see updates in real-time.
          </p>
        </div>
      )}

      {/* MATCH STATUS TAB */}
      {activeTab === 'match-status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
              Match Status
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                { value: 'scheduled', label: 'Scheduled', color: '#8e8e93', icon: '📅' },
                { value: 'live', label: 'Live', color: '#34c759', icon: '●' },
                { value: 'done', label: 'Done', color: '#ef4444', icon: '✓' },
              ] as const).map((status) => (
                <button
                  key={status.value}
                  type="button"
                  onClick={async () => {
                    console.log('[MatchControlPanel] Status change requested:', status.value);
                    props.setFMatchStatus(status.value);
                    // Update Firebase immediately
                    try {
                      // Use imported functions directly
                      await update(matchMetaRef(props.fSport, props.tournamentId, props.matchId), { 
                        status: status.value 
                      });
                      console.log('[MatchControlPanel] Status updated in Firebase:', status.value);
                    } catch (error) {
                      console.error('[MatchControlPanel] Error updating status in Firebase:', error);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: props.fMatchStatus === status.value ? `2px solid ${status.color}` : '1px solid rgba(255,255,255,0.1)',
                    background: props.fMatchStatus === status.value ? `${status.color}20` : 'rgba(255,255,255,0.05)',
                    color: props.fMatchStatus === status.value ? status.color : '#fff',
                    fontSize: '13px',
                    fontWeight: props.fMatchStatus === status.value ? '600' : '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{status.icon}</span>
                  <span>{status.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div style={{
            padding: '12px',
            background: 'rgba(99, 102, 241, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
              <strong style={{ color: '#818cf8' }}>Current Status:</strong> 
              {' '}
              {props.fMatchStatus === 'scheduled' && 'Match is scheduled. Users can make early predictions.'}
              {props.fMatchStatus === 'live' && 'Match is live. Users can make live predictions based on current state.'}
              {props.fMatchStatus === 'done' && 'Match is complete. Go to Match Resolution to finalize and calculate points.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
