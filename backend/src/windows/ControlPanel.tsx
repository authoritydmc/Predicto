import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SetupGuideViewer } from '../components/Notifications/SetupGuideViewer';
import { 
  db, isFirebaseConfigured, onValue, query, ref, schemaRef, update, set,
  saveRoomMeta, clearRoomNode, getOnce, setDiscovery,
  saveInningsHistory, getInningsHistory, archiveToHistory,
  getHistory, wipeMatchData, saveSeasonLeaderboard, updateActiveSession, getDbRoot,
  matchPredictionsRef, tournamentMetaRef, matchMetaRef, matchPredictionsRef as newMatchPredictionsRef,
  matchChatRef, matchHistoryRef, matchInningsHistoryRef, tournamentLeaderboardRef, matchRef,
  matchLiveScoreRef,
  setTournamentDiscovery, setMatchDiscovery, generateMatchId, getMergedMeta,
  saveTournamentSchedule, getTournamentSchedule, addMatchToSchedule,
  getTournamentsBySport, updateTournamentStatus, deleteTournament, deleteMatch, getMatchesByTournament,
  getUserByUsername, adminResetPasskey, adminBlockUser, adminSetUserRole
} from '../firebase/db';
import { getAudienceUrl } from '../utils/shared';
import { getTeamLogoUrl } from '../utils/teamLogos';
import initLogger, { logAction, logFirebaseCall, logError } from '../utils/logger';
import { CricketMatchDetails } from '../components/sports/CricketMatchDetails';
import { FootballMatchDetails } from '../components/sports/FootballMatchDetails';
import { CricketLiveScore } from '../components/sports/CricketLiveScore';
import { FootballLiveScore } from '../components/sports/FootballLiveScore';

// ── LocalStorage Helpers ────────────────────────────────────────────────────────
const STORAGE_KEY = 'controlpanel_ui_state';
const WINDOW_VISIBILITY_KEY = 'window_visibility_defaults';

const loadUIState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const saveUIState = (state: any) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save UI state:', err);
  }
};

const loadWindowVisibility = () => {
  try {
    const saved = localStorage.getItem(WINDOW_VISIBILITY_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    // Default values
    return {
      overlayVisible: true,
      tickerVisible: false,
      reactionVisible: false
    };
  } catch {
    return {
      overlayVisible: true,
      tickerVisible: false,
      reactionVisible: false
    };
  }
};

const saveWindowVisibility = (visibility: any) => {
  try {
    localStorage.setItem(WINDOW_VISIBILITY_KEY, JSON.stringify(visibility));
  } catch (err) {
    console.error('Failed to save window visibility:', err);
  }
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const normalizeRoomId = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 40) || 'ipl';

const escapeHtml = (v = '') =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const oversToBalls = (val: string | number) => {
  const num = Number(val || 0);
  const overs = Math.floor(num);
  const balls = Math.round((num - overs) * 10);
  return overs * 6 + balls;
};

const ballsToOversDisplay = (balls: number) =>
  `${Math.floor(balls / 6)}.${balls % 6} ov`;

// ── CSV Parsing ───────────────────────────────────────────────────────────────────
const parseCSV = (csvText: string): any[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Parse CSV with proper handling of quoted fields
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    // Remove quotes from values
    return result.map(v => v.replace(/^"|"$/g, ''));
  };
  
  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase());
  const matches: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length !== headers.length) continue;
    
    const match: any = {};
    headers.forEach((header, index) => {
      match[header] = values[index];
    });
    matches.push(match);
  }
  
  return matches;
};

const sortHistoryLatestFirst = (h: Record<string, any>) =>
  Object.entries(h).sort((a, b) => {
    const toIso = (s: string) => {
      const p = s.split('_')[0].split('-');
      return p.length === 3 ? (p[0].length === 4 ? s.split('_')[0] : `${p[2]}-${p[1]}-${p[0]}`) : '0000-00-00';
    };
    const iA = toIso(a[0]); const iB = toIso(b[0]);
    return iA !== iB ? iB.localeCompare(iA) : b[0].localeCompare(a[0]);
  });

// ─────────────────────────────────────────────────────────────────────
// Scoring moved to Python scripts
// ─────────────────────────────────────────────────────────────────────
// All scoring calculations are now handled by Python scoring engine
// This ensures single source of truth for automated processing

// ─── Sub-components ───────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="cp-toggle">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className="cp-toggle-track" />
  </label>
);

const RankPill = ({ rank }: { rank: number }) => {
  const cls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
  return <span className={`rank-pill ${cls}`}>{rank}</span>;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ControlPanel: React.FC = () => {
  // Load saved UI state from localStorage
  const savedUIState = loadUIState();

  // ── Settings & Meta State
  const [settings, setSettings] = useState<any>(null);
  const [meta, setMeta] = useState<any>({});
  const [roomId, setRoomId] = useState('ipl');
  const [tournamentId, setTournamentId] = useState(savedUIState?.lastTournamentId || '');
  const [matchId, setMatchId] = useState('');
  const [viewMode, setViewMode] = useState<'tournament' | 'match'>('match');
  
  // ── Window Visibility State
  const [windowVisibility, setWindowVisibility] = useState(loadWindowVisibility());

  // Send window visibility to main process on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).overlayDesktop) {
      (window as any).overlayDesktop.setWindowVisibilityDefaults(windowVisibility);
    }
  }, []);

  // Handle window visibility changes
  const handleWindowVisibilityChange = (key: keyof typeof windowVisibility, value: boolean) => {
    const newVisibility = { ...windowVisibility, [key]: value };
    setWindowVisibility(newVisibility);
    saveWindowVisibility(newVisibility);
    
    if (typeof window !== 'undefined' && (window as any).overlayDesktop) {
      (window as any).overlayDesktop.setWindowVisibilityDefaults(newVisibility);
    }
  };

  // ── Tournament Form State
  const [fTournamentCode, setFTournamentCode] = useState('');
  const [fTournamentName, setFTournamentName] = useState('');
  const [schedule, setSchedule] = useState<any[]>([]);
  const [matchStatuses, setMatchStatuses] = useState<Record<string, string>>({});
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingSchedule, setUploadingSchedule] = useState(false);
  const [availableTournaments, setAvailableTournaments] = useState<any[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [tournamentStatus, setTournamentStatus] = useState<'active' | 'paused' | 'ended'>('active');
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any[]>([]);
  const [availableMatches, setAvailableMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // ── UI Collapse State
  const [collapsedSections, setCollapsedSections] = useState(savedUIState?.collapsedSections || {
    tournament: true,
    match: false,
    resolution: false,
    winProb: false,
    liveScore: false,
    windowEngine: false,
    history: true,
    scheduler: false,
    discordNotifications: false,
    pushNotifications: false,
    userManagement: true
  });

  // ── Tab State
  const [tournamentTab, setTournamentTab] = useState<'details' | 'schedule'>(savedUIState?.tournamentTab || 'details');

  const handleTabChange = (tab: 'details' | 'schedule') => {
    setTournamentTab(tab);
    saveUIState({ 
      collapsedSections, 
      tournamentTab: tab,
      lastSport: fSport
    });
  };

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((prev: any) => {
      const newState = { ...prev, [section]: !prev[section] };
      saveUIState({ 
        collapsedSections: newState, 
        tournamentTab,
        lastSport: fSport,
        lastTournamentId: tournamentId
      });
      return newState;
    });
  };

  // ── Match Form State
  const [fMatchCode, setFMatchCode] = useState('');
  const [fSport, setFSport] = useState(savedUIState?.lastSport || '');
  const [fMatchTitle, setFMatchTitle] = useState('');
  const [fTeamA, setFTeamA] = useState('');
  const [fTeamB, setFTeamB] = useState('');
  const [fTossWinner, setFTossWinner] = useState<'teamA' | 'teamB' | null>(null);
  const [fTossDecision, setFTossDecision] = useState<'bat' | 'bowl' | null>(null);
  const [fBattingTeam, setFBattingTeam] = useState<'teamA' | 'teamB'>('teamA');
  const [fInnings, setFInnings] = useState<'1' | '2'>('1');
  const [fAllowReprediction, setFAllowReprediction] = useState(false);
  const [fAutomationPaused, setFAutomationPaused] = useState(false);
  const [fMatchStatus, setFMatchStatus] = useState<'live' | 'done' | 'scheduled'>('live');
  const [fPredictionsEnabled, setFPredictionsEnabled] = useState(true);
  const [fPredictionsPaused, setFPredictionsPaused] = useState(false);
  const [fPauseReason, setFPauseReason] = useState('');

  // ── Legacy Form State (for backward compatibility)
  const [fRoomId, setFRoomId] = useState('ipl');

  // ── Resolution
  const [fActualScore, setFActualScore] = useState('');
  const [fChaserWon, setFChaserWon] = useState<'yes' | 'no'>('no');
  const [fActualResult, setFActualResult] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [resolutionMessage, setResolutionMessage] = useState('');

  // ── Win Prob
  const [googleUrl, setGoogleUrl] = useState('');
  const [autoFetch, setAutoFetch] = useState(false);
  const [showWinProb, setShowWinProb] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('Status: Not started');

  // ── Live Score
  const [liveScore, setLiveScore] = useState<any>(null);
  const [scoreTeamARuns, setScoreTeamARuns] = useState('');
  const [scoreTeamAWickets, setScoreTeamAWickets] = useState('');
  const [scoreTeamAOvers, setScoreTeamAOvers] = useState('');
  const [scoreTeamBRuns, setScoreTeamBRuns] = useState('');
  const [scoreTeamBWickets, setScoreTeamBWickets] = useState('');
  const [scoreTeamBOvers, setScoreTeamBOvers] = useState('');
  const [scoreMatchStatus, setScoreMatchStatus] = useState<'live' | 'completed' | 'scheduled'>('live');
  const [scoreSource, setScoreSource] = useState<'manual' | 'scraper' | 'api' | 'prediction'>('manual');
  const [scraperRunning, setScraperRunning] = useState(false);
  const [scraperStatus, setScraperStatus] = useState('');
  const [scraperOrder, setScraperOrder] = useState('cricbuzz,google,cricapi');
  const [scraperMatchUrl, setScraperMatchUrl] = useState('');
  const [activeMatchTab, setActiveMatchTab] = useState<'details' | 'live'>('details');
  const [isEditingScore, setIsEditingScore] = useState(false);

  // ── Scheduler State
  const [schedulerTasks, setSchedulerTasks] = useState<Record<string, any>>({});
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerLogs, setSchedulerLogs] = useState<any[]>([]);
  const [activeSchedulerTab, setActiveSchedulerTab] = useState<'tasks' | 'logs'>('tasks');

  // ── Enhanced Automation State
  const [automationStatus, setAutomationStatus] = useState<any>(null);
  const [automationTasks, setAutomationTasks] = useState<Record<string, any>>({});
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  // ── Setup Guide State
  const [setupGuideViewer, setSetupGuideViewer] = useState<{ open: boolean; type: 'discord' | 'push' | null }>({ open: false, type: null });

  // ── Opacity
  const [opacity, setOpacity] = useState(1);
  const [reactionOpacity, setReactionOpacity] = useState(1);

  // ── Dashboard State
  const [resultsOpen, setResultsOpen] = useState(false);
  const [overallOpen, setOverallOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [lastResults, setLastResults] = useState<any[]>([]);
  const [lastOverall, setLastOverall] = useState<any[]>([]);
  const [fullHistory, setFullHistory] = useState<Record<string, any>>({});
  const [historyDetail, setHistoryDetail] = useState<React.ReactNode>(null);
  const [activeHistoryKey, setActiveHistoryKey] = useState<string | null>(null);
  const [seasonSortMode, setSeasonSortMode] = useState<'total' | 'ppg'>('total');
  const [resActualScore, setResActualScore] = useState<string | number>('');
  const [resolveTitle, setResolveTitle] = useState('Innings Leaderboard');

  // ── Manual Entry rows
  const [manDate, setManDate] = useState('');
  const [manTitle, setManTitle] = useState('');
  const [manTeamA, setManTeamA] = useState('');
  const [manTeamB, setManTeamB] = useState('');
  const [manActual1st, setManActual1st] = useState('');
  const [manActual2nd, setManActual2nd] = useState('');
  const [manWinner, setManWinner] = useState<'a' | 'b'>('a');
  const [manRows, setManRows] = useState<any[]>([]);

  // ── Edit Match Modal
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editMatchTitle, setEditMatchTitle] = useState('');
  const [editMatchDate, setEditMatchDate] = useState('');
  const [editTeamA, setEditTeamA] = useState('');
  const [editTeamB, setEditTeamB] = useState('');
  const [editActual1st, setEditActual1st] = useState('');
  const [editActual2nd, setEditActual2nd] = useState('');
  const [editWinner, setEditWinner] = useState<'a' | 'b'>('a');

  // ── Refs for subscriptions
  const heartbeatRef = useRef<any>(null);
  const unsubMetaRef = useRef<any>(null);
  const winProbIntervalRef = useRef<any>(null);

  // ── Firebase Mode State
  const [firebaseMode, setFirebaseModeState] = useState<'local' | 'prod'>(() => {
    return getDbRoot() as 'local' | 'prod';
  });

  // ── User Management State
  const [userSearchUsername, setUserSearchUsername] = useState('');
  const [userSearchResult, setUserSearchResult] = useState<any>(null);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState('');
  const [showUserManagement, setShowUserManagement] = useState(false);

  // ── Action Feedback State
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'warning' | 'info' | null;
    message: string;
    details?: string;
    timestamp?: number;
  }>({ type: null, message: '' });
  const [showActionLog, setShowActionLog] = useState(false);
  const [actionHistory, setActionHistory] = useState<{
    action: string;
    timestamp: number;
    success: boolean;
    details?: string;
    firebaseCalls?: string[];
  }[]>([]);

  // ── Enhanced Toggle Handlers with Immediate Feedback
  const handleTogglePredictions = async (enabled: boolean) => {
    const action = enabled ? 'Enable' : 'Disable';
    
    if (!matchId || !tournamentId) {
      showFeedback('error', 'Please select a match first', 'Match selection required');
      return;
    }
    
    const firebaseOperations = [
      update(matchMetaRef(fSport, tournamentId, matchId), { predictionsEnabled: enabled })
    ];
    
    await executeWithLogging(
      `${action} Predictions`,
      firebaseOperations,
      async () => {
        await update(matchMetaRef(fSport, tournamentId, matchId), { predictionsEnabled: enabled });
        setFPredictionsEnabled(enabled);
        return { enabled };
      },
      `Predictions ${enabled ? 'enabled' : 'disabled'} successfully`,
      `Failed to ${enabled ? 'enable' : 'disable'} predictions`
    );
  };

  const handleTogglePausePredictions = async (paused: boolean) => {
    const action = paused ? 'Pause' : 'Resume';
    
    if (!matchId || !tournamentId) {
      showFeedback('error', 'Please select a match first', 'Match selection required');
      return;
    }
    
    const firebaseOperations = [
      update(matchMetaRef(fSport, tournamentId, matchId), { predictionsPaused: paused })
    ];
    
    await executeWithLogging(
      `${action} Predictions`,
      firebaseOperations,
      async () => {
        await update(matchMetaRef(fSport, tournamentId, matchId), { predictionsPaused: paused });
        setFPredictionsPaused(paused);
        return { paused };
      },
      `Predictions ${paused ? 'paused' : 'resumed'} successfully`,
      `Failed to ${paused ? 'pause' : 'resume'} predictions`
    );
  };

  const handleToggleReprediction = async (allowed: boolean) => {
    const action = allowed ? 'Enable' : 'Disable';
    
    if (!matchId || !tournamentId) {
      showFeedback('error', 'Please select a match first', 'Match selection required');
      return;
    }
    
    const firebaseOperations = [
      update(matchMetaRef(fSport, tournamentId, matchId), { allowReprediction: allowed })
    ];
    
    await executeWithLogging(
      `${action} Re-prediction`,
      firebaseOperations,
      async () => {
        await update(matchMetaRef(fSport, tournamentId, matchId), { allowReprediction: allowed });
        setFAllowReprediction(allowed);
        return { allowed };
      },
      `Re-prediction ${allowed ? 'enabled' : 'disabled'} successfully`,
      `Failed to ${allowed ? 'enable' : 'disable'} re-prediction`
    );
  };

  // ── Pause Reason Dialog State
  const [showPauseReasonDialog, setShowPauseReasonDialog] = useState(false);
  const [tempPauseReason, setTempPauseReason] = useState('');

  // ── Handle Pause with Optional Reason Dialog
  const handlePausePredictionsWithReason = async (pause: boolean) => {
    if (pause && !fPredictionsPaused) {
      // Only show dialog when pausing (not unpausing)
      setTempPauseReason(fPauseReason || '');
      setShowPauseReasonDialog(true);
    } else {
      // Unpausing - just update directly
      await handleTogglePausePredictions(false);
    }
  };

  const confirmPauseReason = async () => {
    setShowPauseReasonDialog(false);
    
    // Update pause reason and pause state together
    if (!matchId || !tournamentId) {
      showFeedback('error', 'Please select a match first', 'Match selection required');
      return;
    }
    
    const firebaseOperations = [
      update(matchMetaRef(fSport, tournamentId, matchId), { 
        predictionsPaused: true, 
        pauseReason: tempPauseReason.trim() || undefined 
      })
    ];
    
    await executeWithLogging(
      'Pause Predictions with Reason',
      firebaseOperations,
      async () => {
        await update(matchMetaRef(fSport, tournamentId, matchId), { 
          predictionsPaused: true, 
          pauseReason: tempPauseReason.trim() || undefined 
        });
        setFPredictionsPaused(true);
        setFPauseReason(tempPauseReason.trim() || '');
        return { paused: true, reason: tempPauseReason.trim() || '' };
      },
      'Predictions paused successfully',
      'Failed to pause predictions'
    );
  };

  const cancelPauseReason = () => {
    setShowPauseReasonDialog(false);
    setTempPauseReason('');
  };

  // ── Note: Prediction controls are synced via Firebase subscription in subscribeToMeta
  // No auto-sync needed as changes from other clients will be reflected automatically

  // ─────────────────────────────────────────────────────────────────────────────
  // Action Feedback & Logging Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const showFeedback = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string, details?: string) => {
    setActionFeedback({ type, message, details, timestamp: Date.now() });
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        setActionFeedback(prev => prev.type === 'success' ? { type: null, message: '' } : prev);
      }, 5000);
    }
    
    // Log the action
    logAction(`[ControlPanel] ${type.toUpperCase()}: ${message}`, { details });
  }, []);

  const logActionWithFirebase = useCallback((actionName: string, firebaseCalls: string[], success: boolean, details?: string) => {
    const logEntry = {
      action: actionName,
      timestamp: Date.now(),
      success,
      details,
      firebaseCalls
    };
    
    setActionHistory(prev => [logEntry, ...prev.slice(0, 99)]); // Keep last 100 actions
    
    // Log each Firebase call
    firebaseCalls.forEach(call => {
      logFirebaseCall(`[ControlPanel] ${actionName} - ${call}`);
    });
    
    // Log overall action
    logAction(`[ControlPanel] ${actionName}`, { success, details, firebaseCallCount: firebaseCalls.length });
  }, []);

  const executeWithLogging = useCallback(async (
    actionName: string,
    firebaseOperations: Promise<any>[],
    operation: () => Promise<any>,
    successMessage: string,
    errorMessage: string
  ): Promise<any> => {
    const startTime = Date.now();
    const firebaseCallNames: string[] = [];
    
    try {
      showFeedback('info', `Starting ${actionName}...`, 'Executing operation...');
      
      // Track Firebase operations
      firebaseOperations.forEach((op: any, index: number) => {
        firebaseCallNames.push(`Firebase Operation ${index + 1}`);
      });
      
      const result = await operation();
      const duration = Date.now() - startTime;
      
      showFeedback('success', successMessage, `Completed in ${duration}ms`);
      logActionWithFirebase(actionName, firebaseCallNames, true, `Duration: ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorDetails = error instanceof Error ? error.message : 'Unknown error';
      
      showFeedback('error', errorMessage, errorDetails);
      logActionWithFirebase(actionName, firebaseCallNames, false, `Error: ${errorDetails}, Duration: ${duration}ms`);
      logError(`[ControlPanel] ${actionName} failed:`, error);
      
      return null;
    }
  }, [showFeedback, logActionWithFirebase]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Initialize websocket logger
    initLogger('ControlPanel');

    const init = async () => {
      // @ts-ignore
      const s = await window.overlayDesktop.getSettings();
      setSettings(s);
      setOpacity(s.opacity ?? 1);
      setReactionOpacity(s.reactionOpacity ?? 1);
      const sport = s.sport || 'cricket';
      setFSport(sport);
      if (s.matchId && s.tournamentId) {
        setMatchId(s.matchId);
        setTournamentId(s.tournamentId);
        subscribeToMeta(sport, s.tournamentId, s.matchId);
      } else if (s.tournamentId) {
        setTournamentId(s.tournamentId);
        subscribeToMeta(sport, s.tournamentId);
      }
    };
    init();

    // @ts-ignore
    window.overlayDesktop.onSettingsChanged((s: any) => {
      setSettings(s);
      setOpacity(s.opacity ?? 1);
      const sport = s.sport || 'cricket';
      setFSport(sport);
      if (s.matchId && s.tournamentId) {
        setMatchId(s.matchId);
        setTournamentId(s.tournamentId);
        subscribeToMeta(sport, s.tournamentId, s.matchId);
      } else if (s.tournamentId) {
        setTournamentId(s.tournamentId);
        subscribeToMeta(sport, s.tournamentId);
      }
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (unsubMetaRef.current) unsubMetaRef.current();
      if (winProbIntervalRef.current) clearInterval(winProbIntervalRef.current);
    };
  }, []);

  // WebSocket connection for enhanced automation monitoring
  useEffect(() => {
    // Initialize WebSocket connection to automation orchestrator
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('ws://localhost:9222');
        
        ws.onopen = () => {
          console.log('[ControlPanel] Connected to automation orchestrator');
          setWsConnection(ws);
          
          // Request initial status
          ws.send(JSON.stringify({
            type: 'get_status',
            timestamp: Date.now()
          }));
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('[ControlPanel] Error parsing WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('[ControlPanel] Disconnected from automation orchestrator');
          setWsConnection(null);
          setSchedulerRunning(false);
          
          // Attempt to reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
        
        ws.onerror = (error) => {
          console.error('[ControlPanel] WebSocket error:', error);
          setSchedulerRunning(false);
        };
        
        return ws;
      } catch (error) {
        console.error('[ControlPanel] Failed to connect to automation orchestrator:', error);
        return null;
      }
    };

    const ws = connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Handle WebSocket messages from automation orchestrator
  const handleWebSocketMessage = (message: any) => {
    const { type, data, timestamp } = message;

    if (!type || message.level || message.window || message.source || message.message) {
      return;
    }
    
    switch (type) {
      case 'status_update':
        if (data.automation_status) {
          setAutomationStatus(data.automation_status);
          setSchedulerRunning(data.automation_status.orchestrator_running);
        }
        if (data.component_health) {
          // Update component health status
          Object.entries(data.component_health).forEach(([component, health]: [string, any]) => {
            if (component === 'match_manager' || component === 'scraper_manager' || component === 'scoring_engine') {
              // Update scheduler running status based on component health
              setSchedulerRunning(health.status === 'running');
            }
          });
        }
        break;
        
      case 'task_update':
        if (data.task) {
          setAutomationTasks(prev => ({
            ...prev,
            [data.task.task_id]: data.task
          }));
        }
        break;
        
      case 'log_entry':
        if (data.data) {
          setAutomationLogs(prev => [data.data, ...prev.slice(0, 999)]); // Keep last 1000 logs
        }
        break;
        
      case 'alert':
        console.warn('[ControlPanel] Automation alert:', data);
        // Could show toast notifications for alerts
        break;
        
      case 'component_status':
        if (data.data) {
          // Update individual component status
          const component = data.data.name;
          if (component === 'orchestrator') {
            setSchedulerRunning(data.data.status === 'running');
          }
        }
        break;
        
      default:
        setAutomationLogs(prev => [{
          level: 'debug',
          component: 'websocket',
          message: `Ignored message type: ${type}`,
          timestamp: timestamp || Date.now()
        }, ...prev.slice(0, 999)]);
    }
  };

  // Auto-fetch interval
  useEffect(() => {
    if (winProbIntervalRef.current) clearInterval(winProbIntervalRef.current);
    if (autoFetch) {
      winProbIntervalRef.current = setInterval(() => {
        if (googleUrl.trim()) performWinProbFetch();
      }, 30000);
    }
    return () => { if (winProbIntervalRef.current) clearInterval(winProbIntervalRef.current); };
  }, [autoFetch, googleUrl]);

  // Load available tournaments when sport changes
  useEffect(() => {
    const loadTournaments = async () => {
      if (!isFirebaseConfigured || !db) return;
      setLoadingTournaments(true);
      try {
        const tournaments = await getTournamentsBySport(fSport);
        setAvailableTournaments(tournaments);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTournaments(false);
      }
    };
    loadTournaments();
  }, [fSport]);

  // Load matches when tournament is selected
  useEffect(() => {
    const loadMatches = async () => {
      if (!tournamentId || !isFirebaseConfigured || !db) return;
      setLoadingMatches(true);
      try {
        const matches = await getMatchesByTournament(fSport, tournamentId);
        setAvailableMatches(matches);

        // Auto-select best match if no match is currently selected
        if (!matchId && matches.length > 0) {
          // Priority: Upcoming scheduled match > Live match > First match
          const scheduledMatches = matches
            .filter((m: any) => m.status === 'scheduled' && m.date)
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const upcomingMatch = scheduledMatches.find((m: any) => new Date(m.date) >= new Date());
          const liveMatch = matches.find((m: any) => m.status === 'live');

          const bestMatch = upcomingMatch || liveMatch || matches[0];

          setMatchId(bestMatch.matchId);
          setFMatchCode(bestMatch.matchId);
          setFMatchTitle(bestMatch.matchTitle);
          setFTeamA(bestMatch.teamA);
          setFTeamB(bestMatch.teamB);
          subscribeToMeta(fSport, tournamentId, bestMatch.matchId);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMatches(false);
      }
    };
    loadMatches();
  }, [tournamentId, fSport]);

  // Load schedule when tournament is selected
  useEffect(() => {
    const loadSchedule = async () => {
      if (!tournamentId || !isFirebaseConfigured || !db) return;
      try {
        const loadedSchedule = await getTournamentSchedule(fSport, tournamentId);
        setSchedule(loadedSchedule);
        
        // Load match statuses
        const statuses: Record<string, string> = {};
        for (const match of loadedSchedule) {
          if (match.matchId) {
            try {
              const metaSnap = await getOnce(matchMetaRef(fSport, tournamentId, match.matchId));
              const meta = metaSnap.val();
              if (meta && meta.status) {
                statuses[match.matchId] = meta.status;
              } else {
                statuses[match.matchId] = 'scheduled';
              }
            } catch (err) {
              statuses[match.matchId] = 'scheduled';
            }
          }
        }
        setMatchStatuses(statuses);
      } catch (err) {
        console.error(err);
      }
    };
    loadSchedule();
  }, [tournamentId, fSport]);

  // Auto-mark matches as done if no live score update for past 6 hours
  useEffect(() => {
    if (!tournamentId || !isFirebaseConfigured || !db || schedule.length === 0) return;
    
    const checkAndMarkDoneMatches = async () => {
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;
      const oneHour = 60 * 60 * 1000;
      
      for (const match of schedule) {
        if (!match.matchId) continue;
        
        try {
          // Check live score data for lastUpdated timestamp
          const liveScoreSnap = await getOnce(matchLiveScoreRef(fSport, tournamentId, match.matchId));
          const liveScore = liveScoreSnap.val();
          
          // Check match meta for current status and creation time
          const metaSnap = await getOnce(matchMetaRef(fSport, tournamentId, match.matchId));
          const meta = metaSnap.val();
          
          if (meta && meta.status === 'live') {
            // Don't auto-mark if match was created recently (within 1 hour)
            const matchCreatedAt = meta.createdAt || 0;
            if (now - matchCreatedAt < oneHour) {
              continue;
            }
            
            // If no live score data exists, or if lastUpdated is older than 6 hours
            if (!liveScore || !liveScore.lastUpdated || (now - liveScore.lastUpdated) > sixHours) {
              await update(matchMetaRef(fSport, tournamentId, match.matchId), {
                status: 'done',
                endedAt: now,
                autoMarked: true,
                autoMarkReason: 'no_update_6h'
              });
              console.log(`Auto-marked match ${match.matchId} as done (no update for 6+ hours)`);
            }
          }
        } catch (err) {
          console.error(`Error auto-marking match ${match.matchId}:`, err);
        }
      }
    };
    
    checkAndMarkDoneMatches();
  }, [tournamentId, fSport, schedule]);

  // Auto-select next upcoming match from schedule (only if no existing matches)
  useEffect(() => {
    if (schedule.length > 0 && !matchId && availableMatches.length === 0) {
      const now = new Date();
      const upcomingMatches = schedule
        .filter((m: any) => m.date && new Date(m.date) >= now)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (upcomingMatches.length > 0) {
        const nextMatch = upcomingMatches[0];

        // Check if this match already exists in availableMatches by matching teams
        const existingMatch = availableMatches.find((m: any) =>
          (m.teamA === nextMatch.teamA && m.teamB === nextMatch.teamB) ||
          (m.teamA === nextMatch.teamB && m.teamB === nextMatch.teamA)
        );

        if (existingMatch) {
          // Use existing match data
          setMatchId(existingMatch.matchId);
          setFMatchCode(existingMatch.matchId);
          setFMatchTitle(existingMatch.matchTitle);
          setFTeamA(existingMatch.teamA);
          setFTeamB(existingMatch.teamB);
          subscribeToMeta(fSport, tournamentId, existingMatch.matchId);
        } else {
          // Use schedule data
          setFMatchTitle(nextMatch.matchTitle);
          setFTeamA(nextMatch.teamA);
          setFTeamB(nextMatch.teamB);
          // Generate and set match code
          const generatedMatchId = nextMatch.matchId || generateMatchId(nextMatch.teamA, nextMatch.teamB, nextMatch.date ? new Date(nextMatch.date) : undefined);
          setFMatchCode(generatedMatchId);
          setMatchId(generatedMatchId);
        }
      }
    }
  }, [schedule, matchId, availableMatches, tournamentId, fSport]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Firebase Mode Switch Handler
  // ─────────────────────────────────────────────────────────────────────────────
  const handleFirebaseModeSwitch = async (newMode: 'local' | 'prod') => {
    if (firebaseMode === newMode) return;
    
    console.log(`[ControlPanel] Switching Firebase mode from ${firebaseMode} to ${newMode}`);
    
    try {
      localStorage.setItem('firebase_mode', newMode);
      // @ts-ignore
      await window.overlayDesktop.setFirebaseMode(newMode);
      setFirebaseModeState(newMode);
      console.log(`[ControlPanel] Successfully switched to ${newMode.toUpperCase()} mode`);
    } catch (error) {
      console.error('[ControlPanel] Error switching Firebase mode:', error);
      // Revert on error
      localStorage.setItem('firebase_mode', firebaseMode);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Firebase Meta Subscription
  // ─────────────────────────────────────────────────────────────────────────────
  const subscribeToMeta = useCallback((sport: string, tournamentId: string, matchId?: string) => {
    if (unsubMetaRef.current) unsubMetaRef.current();
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    if (!isFirebaseConfigured || !db) return;

    const tick = () => updateActiveSession(matchId || tournamentId).catch(console.error);
    tick();
    heartbeatRef.current = setInterval(tick, 20000);

    if (matchId) {
      // Subscribe to match meta with tournament defaults merged
      unsubMetaRef.current = onValue(matchMetaRef(sport, tournamentId, matchId), snap => {
        const matchMeta = snap.val() || {};
        // Also get tournament meta for defaults
        getOnce(tournamentMetaRef(sport, tournamentId)).then((tourneySnap: any) => {
          const tourneyMeta = tourneySnap.val() || {};
          const merged = { ...tourneyMeta, ...matchMeta };
          setMeta(merged);
          setFMatchTitle(merged.matchTitle || '');
          setFTeamA(merged.teamA || '');
          setFTeamB(merged.teamB || '');
          setFAllowReprediction(Boolean(merged.allowReprediction));
          setFAutomationPaused(Boolean(merged.automationPaused));
          setGoogleUrl(merged.googleMatchUrl || '');
          setShowWinProb(Boolean(merged.showWinProb));
          if (!merged.disableScoreA && merged.disableScoreB) setFBattingTeam('teamA');
          else if (!merged.disableScoreB && merged.disableScoreA) setFBattingTeam('teamB');
          setFInnings(merged.secondInnings ? '2' : '1');
          // Load toss information
          setFTossWinner(merged.tossWinner || null);
          setFTossDecision(merged.tossDecision || null);
          // Load match status
          setFMatchStatus(merged.status || 'live');
          // Load prediction control settings
          setFPredictionsEnabled(merged.predictionsEnabled !== undefined ? merged.predictionsEnabled : true);
          setFPredictionsPaused(merged.predictionsPaused || false);
          setFPauseReason(merged.pauseReason || '');
          
          // Log when Firebase values differ from local state
          if (merged.predictionsEnabled !== undefined && merged.predictionsEnabled !== fPredictionsEnabled) {
            console.log('[ControlPanel] Synced predictionsEnabled from Firebase:', merged.predictionsEnabled);
          }
          if (merged.predictionsPaused !== undefined && merged.predictionsPaused !== fPredictionsPaused) {
            console.log('[ControlPanel] Synced predictionsPaused from Firebase:', merged.predictionsPaused);
          }
          if (merged.pauseReason !== undefined && merged.pauseReason !== fPauseReason) {
            console.log('[ControlPanel] Synced pauseReason from Firebase:', merged.pauseReason);
          }
        });
      });

      // Subscribe to live score
      onValue(matchLiveScoreRef(sport, tournamentId, matchId), snap => {
        const score = snap.val();
        setLiveScore(score);
        // Only update input values if user is not actively editing
        if (score && !isEditingScore) {
          setScoreTeamARuns(score.teamA?.runs?.toString() || '');
          setScoreTeamAWickets(score.teamA?.wickets?.toString() || '');
          setScoreTeamAOvers(score.teamA?.overs?.toString() || '');
          setScoreTeamBRuns(score.teamB?.runs?.toString() || '');
          setScoreTeamBWickets(score.teamB?.wickets?.toString() || '');
          setScoreTeamBOvers(score.teamB?.overs?.toString() || '');
          setScoreMatchStatus(score.matchStatus || 'live');
          setScoreSource(score.source || 'manual');
        }
      });
    } else {
      // Subscribe to tournament meta only
      unsubMetaRef.current = onValue(tournamentMetaRef(sport, tournamentId), snap => {
        const m = snap.val() || {};
        setMeta(m);
      });
    }
  }, [fSport, tournamentId, matchId, isFirebaseConfigured, db]);

  // Load scheduler tasks on mount and check scheduler status
  useEffect(() => {
    loadSchedulerTasks();
    checkSchedulerStatus();
    
    // Poll scheduler status every 5 seconds
    const interval = setInterval(checkSchedulerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkSchedulerStatus = async () => {
    try {
      // @ts-ignore
      const status = await window.overlayDesktop.getSchedulerStatus();
      setSchedulerRunning(status.running);
    } catch (error) {
      console.error('[ControlPanel] Error checking scheduler status:', error);
    }
  };

  const initializeSchedulerTasks = async () => {
    if (!isFirebaseConfigured || !db) return;
    try {
      const defaultTasks = {
        cricket_score_calc: {
          name: 'Cricket Score Calculator',
          script: 'automation/cricket/run_calculator.py',
          interval_seconds: 60,
          enabled: true,
          last_status: 'idle',
          last_run: null
        },
        football_score_calc: {
          name: 'Football Score Calculator',
          script: 'automation/football/run_calculator.py',
          interval_seconds: 60,
          enabled: true,
          last_status: 'idle',
          last_run: null
        },
        tournament_leaderboard: {
          name: 'Tournament Leaderboard Updater',
          script: 'automation/base/run_leaderboard.py',
          interval_seconds: 300,
          enabled: true,
          last_status: 'idle',
          last_run: null
        }
      };
      
      await update(ref(db, getDbRoot() + '/scheduler_config/tasks'), defaultTasks);
      await loadSchedulerTasks();
      alert('Default scheduler tasks initialized');
    } catch (error) {
      console.error('[ControlPanel] Error initializing scheduler tasks:', error);
      alert('Failed to initialize scheduler tasks');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Computed from Form/Meta
  // ─────────────────────────────────────────────────────────────────────────────
  const is2nd = fInnings === '2';
  const chasingTeam = (() => {
    const tA = fTeamA || 'Team A'; const tB = fTeamB || 'Team B';
    if (meta.disableScoreA && !meta.disableScoreB) return tB;
    if (meta.disableScoreB && !meta.disableScoreA) return tA;
    return fBattingTeam === 'teamA' ? tB : tA;
  })();

  const getFormMeta = () => ({
    matchTitle: fMatchTitle,
    teamA: fTeamA,
    teamB: fTeamB,
    allowReprediction: fAllowReprediction,
    disableScoreA: fBattingTeam === 'teamB',
    disableScoreB: fBattingTeam === 'teamA',
    secondInnings: is2nd,
    predictionSort: meta.predictionSort || 'newest',
    predictionsPaused: Boolean(meta.predictionsPaused),
    hideChat: Boolean(meta.hideChat),
    hideJoin: Boolean(meta.hideJoin),
    automationPaused: fAutomationPaused
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Tournament (Legacy - for backward compatibility)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    const tCode = normalizeRoomId(fTournamentCode);
    const tId = tCode;
    
    if (!tId) {
      alert('Please enter a tournament code');
      return;
    }
    
    try {
      // 1. Set tournament discovery
      await setTournamentDiscovery(tId, fSport, tId);
      
      // 2. Save tournament meta
      if (isFirebaseConfigured && db) {
        await update(tournamentMetaRef(fSport, tId), {
          tournamentName: fTournamentName,
          status: tournamentStatus,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      
      // 3. Save schedule if provided
      if (schedule.length > 0) {
        await saveTournamentSchedule(fSport, tId, schedule);
      }
      
      setTournamentId(tId);
      // Reload tournaments
      const tournaments = await getTournamentsBySport(fSport);
      setAvailableTournaments(tournaments);
      alert(`Tournament [${fTournamentName}] created with code: ${tId}`);
    } catch (err) { console.error(err); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Update Tournament Status
  // ─────────────────────────────────────────────────────────────────────────────
  const handleUpdateTournamentStatus = async (status: 'active' | 'paused' | 'ended') => {
    if (!tournamentId) return;
    try {
      await updateTournamentStatus(fSport, tournamentId, status);
      setTournamentStatus(status);
      // Reload tournaments list
      const tournaments = await getTournamentsBySport(fSport);
      setAvailableTournaments(tournaments);
      alert(`Tournament status updated to: ${status}`);
    } catch (err) {
      console.error(err);
      alert('Error updating tournament status');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Select Tournament
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSelectTournament = async (selectedTournament: any) => {
    setTournamentId(selectedTournament.tournamentId);
    setFTournamentCode(selectedTournament.tournamentId);
    setFTournamentName(selectedTournament.tournamentName);
    setTournamentStatus(selectedTournament.status || 'active');
    
    // Load schedule
    if (isFirebaseConfigured && db) {
      const loadedSchedule = await getTournamentSchedule(fSport, selectedTournament.tournamentId);
      setSchedule(loadedSchedule);
      setEditingSchedule(loadedSchedule);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Open Schedule Editor
  // ─────────────────────────────────────────────────────────────────────────────
  const handleOpenScheduleEditor = () => {
    setEditingSchedule([...schedule]);
    setShowScheduleEditor(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Save Schedule
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSaveSchedule = async () => {
    if (!tournamentId || !isFirebaseConfigured || !db) return;
    try {
      await saveTournamentSchedule(fSport, tournamentId, editingSchedule);
      setSchedule(editingSchedule);
      setShowScheduleEditor(false);
      alert('Schedule updated successfully');
    } catch (err) {
      console.error(err);
      alert('Error saving schedule');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Load Match from Schedule
  // ─────────────────────────────────────────────────────────────────────────────
  const handleLoadMatchFromSchedule = (match: any) => {
    setFTeamA(match.teamA);
    setFTeamB(match.teamB);
    setFMatchTitle(match.matchTitle);
    // Always generate match code to ensure it exists
    const generatedMatchId = match.matchId || generateMatchId(match.teamA, match.teamB, match.date ? new Date(match.date) : undefined);
    setFMatchCode(generatedMatchId);
    setMatchId(generatedMatchId);
    setViewMode('match');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Delete Tournament
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDeleteTournament = async () => {
    if (!tournamentId) return;
    if (!confirm(`Are you sure you want to delete tournament "${fTournamentName}"? This will delete all matches and data.`)) return;
    
    try {
      await deleteTournament(fSport, tournamentId);
      setTournamentId('');
      setFTournamentCode('');
      setFTournamentName('');
      setSchedule([]);
      setAvailableMatches([]);
      // Reload tournaments
      const tournaments = await getTournamentsBySport(fSport);
      setAvailableTournaments(tournaments);
      alert('Tournament deleted successfully');
    } catch (err) {
      console.error(err);
      alert('Error deleting tournament');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Delete Match
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDeleteMatch = async (matchIdToDelete: string) => {
    if (!tournamentId) return;
    if (!confirm('Are you sure you want to delete this match? This will delete all predictions and data.')) return;
    
    try {
      await deleteMatch(fSport, tournamentId, matchIdToDelete);
      // Reload matches
      const matches = await getMatchesByTournament(fSport, tournamentId);
      setAvailableMatches(matches);
      alert('Match deleted successfully');
    } catch (err) {
      console.error(err);
      alert('Error deleting match');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Select Match
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSelectMatch = async (selectedMatch: any) => {
    setMatchId(selectedMatch.matchId);
    setFMatchCode(selectedMatch.matchId);
    setFMatchTitle(selectedMatch.matchTitle);
    setFTeamA(selectedMatch.teamA);
    setFTeamB(selectedMatch.teamB);
    setViewMode('match');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // User Management Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSearchUser = async () => {
    if (!userSearchUsername.trim()) {
      setUserSearchError('Please enter a username');
      return;
    }

    setUserSearchLoading(true);
    setUserSearchError('');
    setUserSearchResult(null);

    try {
      const userData = await getUserByUsername(userSearchUsername.trim());
      if (userData) {
        setUserSearchResult(userData);
      } else {
        setUserSearchError('User not found');
      }
    } catch (err) {
      console.error('Error searching user:', err);
      setUserSearchError('Error searching for user');
    } finally {
      setUserSearchLoading(false);
    }
  };

  const handleResetPasskey = async () => {
    if (!userSearchResult || !userSearchUsername) return;

    if (!confirm(`Are you sure you want to reset the passkey for "${userSearchUsername}"?`)) return;

    try {
      const newPasskey = await adminResetPasskey(userSearchUsername);
      alert(`Passkey reset successfully! New passkey: ${newPasskey}`);
      // Refresh user data
      const userData = await getUserByUsername(userSearchUsername);
      setUserSearchResult(userData);
    } catch (err) {
      console.error('Error resetting passkey:', err);
      alert('Error resetting passkey');
    }
  };

  const handleBlockUser = async (block: boolean) => {
    if (!userSearchResult || !userSearchUsername) return;

    const action = block ? 'block' : 'unblock';
    if (!confirm(`Are you sure you want to ${action} "${userSearchUsername}"?`)) return;

    try {
      await adminBlockUser(userSearchUsername, block);
      alert(`User ${action}ed successfully`);
      // Refresh user data
      const userData = await getUserByUsername(userSearchUsername);
      setUserSearchResult(userData);
    } catch (err) {
      console.error(`Error ${action}ing user:`, err);
      alert(`Error ${action}ing user`);
    }
  };

  const handleSetUserRole = async (role: 'user' | 'admin' | 'moderator') => {
    if (!userSearchResult || !userSearchUsername) return;

    if (!confirm(`Are you sure you want to set role for "${userSearchUsername}" to "${role}"?`)) return;

    try {
      await adminSetUserRole(userSearchUsername, role);
      alert(`User role updated successfully to ${role}`);
      // Refresh user data
      const userData = await getUserByUsername(userSearchUsername);
      setUserSearchResult(userData);
    } catch (err) {
      console.error('Error setting user role:', err);
      alert('Error setting user role');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CSV Upload Handler
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!tournamentId) {
      showFeedback('error', 'Please select a tournament first before uploading a schedule', 'Tournament selection is required');
      e.target.value = '';
      return;
    }
    
    if (!fSport) {
      showFeedback('error', 'Please select a sport first before uploading a schedule', 'Sport selection is required');
      e.target.value = '';
      return;
    }
    
    setCsvFile(file);
    setUploadingSchedule(true);
    
    const firebaseOperations = [
      saveTournamentSchedule(fSport, tournamentId, [])
    ];
    
    return await executeWithLogging(
      'Upload CSV Schedule',
      firebaseOperations,
      async () => {
        const text = await file.text();
        console.log('CSV Content:', text.substring(0, 500));
        
        const parsedSchedule = parseCSV(text);
        console.log('Parsed Schedule:', parsedSchedule);
        
        if (parsedSchedule.length === 0) {
          throw new Error('No matches found in CSV file. Please check the format.\n\nExpected CSV format:\nteamA,teamB,date,venue,matchTitle\nCSK,MI,2024-03-15,Mumbai,CSK vs MI');
        }
        
        // Validate and transform schedule
        const transformedSchedule = parsedSchedule.map((match: any) => {
          // Handle different CSV formats
          const teamA = match.teama || match.team_a || match['home team'] || match['Home Team'];
          const teamB = match.teamb || match.team_b || match['away team'] || match['Away Team'];
          const date = match.date || match['Date'];
          const venue = match.venue || match['Venue'] || match['Start Time'] || '';
          const matchTitle = match.matchtitle || match.match_title || match['room name'] || match['Room Name'] || `${teamA} vs ${teamB}`;
          
          return {
            matchId: generateMatchId(teamA, teamB, date ? new Date(date) : undefined),
            teamA,
            teamB,
            date,
            venue,
            matchTitle,
            status: 'scheduled'
          };
        });
        
        console.log('Transformed Schedule:', transformedSchedule);
        
        setSchedule(transformedSchedule);
        setEditingSchedule(transformedSchedule);
        
        // Auto-save to Firebase
        await saveTournamentSchedule(fSport, tournamentId, transformedSchedule);
        
        return { matchesProcessed: transformedSchedule.length };
      },
      `Successfully parsed and saved matches from CSV`,
      'Error parsing CSV file'
    ).finally(() => {
      setUploadingSchedule(false);
      e.target.value = '';
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Match
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate tournament selection
    if (!tournamentId) {
      showFeedback('error', 'Please select a valid tournament first before creating a match', 'Tournament selection is required');
      return;
    }
    
    // Validate tournament exists in available tournaments
    const tournamentExists = availableTournaments.some(t => t.tournamentId === tournamentId);
    if (!tournamentExists) {
      showFeedback('error', 'Invalid tournament selected. Please select a valid tournament from the list.', 'Tournament validation failed');
      return;
    }
    
    const mCode = normalizeRoomId(fMatchCode);
    const mId = mCode;
    const tId = tournamentId;
    
    const firebaseOperations = [
      setMatchDiscovery(mCode, fSport, tournamentId, mCode),
      update(matchMetaRef(fSport, tournamentId, mCode), {})
    ];
    
    return await executeWithLogging(
      `Create Match: ${fMatchTitle || `${fTeamA} vs ${fTeamB}`}`,
      firebaseOperations,
      async () => {
        // 1. Set match discovery
        await setMatchDiscovery(mCode, fSport, tournamentId, mCode);
        
        // 2. Save match meta
        if (isFirebaseConfigured && db) {
          const metaUpdate: any = {
            matchTitle: fMatchTitle,
            teamA: fTeamA,
            teamB: fTeamB,
            allowReprediction: fAllowReprediction,
            automationPaused: fAutomationPaused,
            // In scheduler mode, create matches as 'scheduled' by default
            status: schedulerRunning ? 'scheduled' : fMatchStatus,
            predictionsEnabled: fPredictionsEnabled,
            predictionsPaused: fPredictionsPaused,
            pauseReason: fPauseReason,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          
          // Only set batting-related fields when match is live (not scheduled)
          if (fMatchStatus === 'live') {
            metaUpdate.battingTeam = fBattingTeam;
            metaUpdate.innings = fInnings;
            metaUpdate.disableScoreA = fBattingTeam === 'teamB';
            metaUpdate.disableScoreB = fBattingTeam === 'teamA';
            metaUpdate.secondInnings = fInnings === '2';
            // Remove autoMarked fields when status is manually set to live
            metaUpdate.autoMarked = false;
            metaUpdate.autoMarkReason = null;
            metaUpdate.endedAt = null;
          }
          
          await update(matchMetaRef(fSport, tournamentId, mCode), metaUpdate);
        }
        
        // 3. Update local settings
        // @ts-ignore
        const nextS = await window.overlayDesktop.updateSettings({ 
          sport: fSport, 
          tournamentId: tId,
          matchId: mId,
          opacity 
        });
        setSettings(nextS);
        setMatchId(mId);
        
        subscribeToMeta(fSport, tId, mId);
        // @ts-ignore
        await window.overlayDesktop.reloadOverlay();
        
        return { matchId: mId, matchTitle: fMatchTitle || `${fTeamA} vs ${fTeamB}` };
      },
      `Match [${fMatchTitle || `${fTeamA} vs ${fTeamB}`}] created with code: ${mId}`,
      'Failed to create match'
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Live Score Update (Manual button)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleUpdateLiveScore = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) {
      showFeedback('error', 'Please select a match first', 'Match selection required');
      return;
    }

    const firebaseOperations = [
      set(matchLiveScoreRef(fSport, tournamentId, matchId), {}),
      update(matchMetaRef(fSport, tournamentId, matchId), {})
    ];

    return await executeWithLogging(
      'Update Live Score',
      firebaseOperations,
      async () => {
        const scoreData: any = {
          matchStatus: scoreMatchStatus,
          source: scoreSource,
          lastUpdated: Date.now()
        };

        if (fSport === 'cricket') {
          scoreData.teamA = {
            runs: parseInt(scoreTeamARuns) || 0,
            wickets: parseInt(scoreTeamAWickets) || 0,
            overs: parseFloat(scoreTeamAOvers) || 0,
            battingTeam: true
          };
          scoreData.teamB = {
            runs: parseInt(scoreTeamBRuns) || 0,
            wickets: parseInt(scoreTeamBWickets) || 0,
            overs: parseFloat(scoreTeamBOvers) || 0,
            battingTeam: false
          };
          scoreData.currentInnings = fInnings === '2' ? 2 : 1;
          
          // Set secondInningsStart if transitioning to 2nd innings
          if (fInnings === '2' && (!liveScore || liveScore.currentInnings !== 2)) {
            scoreData.secondInningsStart = Date.now();
          }
          
          // Calculate battingFirst
          let battingFirst: string | null = null;
          if (fInnings === '2' && meta.innings !== '2') {
            // When moving to 2nd innings, the team that was batting first is now known
            // It's the opposite of the current batting team
            battingFirst = fBattingTeam === 'teamA' ? 'teamB' : 'teamA';
          } else if (fInnings === '1' && !meta.battingFirst) {
            // In 1st innings, the current batting team is batting first
            battingFirst = fBattingTeam;
          } else {
            // Use existing value from meta
            battingFirst = meta.battingFirst || null;
          }
          
          // Store batting information in live score as well
          scoreData.currentInnings = Number(fInnings);
          scoreData.battingTeam = fBattingTeam;
          if (battingFirst) {
            scoreData.battingFirst = battingFirst;
          }
          
          // Update match meta with batting team info and toss information
          const metaUpdate: any = {
            disableScoreA: fBattingTeam === 'teamB',
            disableScoreB: fBattingTeam === 'teamA',
            innings: fInnings,
            battingTeam: fBattingTeam,
            secondInnings: fInnings === '2'
          };
          
          // Store battingFirst explicitly
          if (battingFirst) {
            metaUpdate.battingFirst = battingFirst;
          }
          
          // Add toss information if provided
          if (fTossWinner) {
            metaUpdate.tossWinner = fTossWinner;
          }
          if (fTossDecision) {
            metaUpdate.tossDecision = fTossDecision;
          }
          
          // Remove autoMarked fields when updating live score (match is active)
          metaUpdate.autoMarked = false;
          metaUpdate.autoMarkReason = null;
          metaUpdate.endedAt = null;
          
          await update(matchMetaRef(fSport, tournamentId, matchId), metaUpdate);
        } else if (fSport === 'football') {
          scoreData.teamA = {
            goals: parseInt(scoreTeamARuns) || 0,
            battingTeam: false
          };
          scoreData.teamB = {
            goals: parseInt(scoreTeamBRuns) || 0,
            battingTeam: true
          };
        }

        await set(matchLiveScoreRef(fSport, tournamentId, matchId), scoreData);
        return { success: true, scoreData };
      },
      'Live score updated successfully',
      'Error updating live score'
    );
  };

  const handleRunScraper = async () => {
    if (!matchId || !fTeamA || !fTeamB) {
      alert('Please select a match with team names first');
      return;
    }

    setScraperRunning(true);
    setScraperStatus('Initializing scraper...');

    try {
      // @ts-ignore
      const result = await window.overlayDesktop.runScraper(fSport, matchId, fTeamA, fTeamB, scraperOrder, scraperMatchUrl || undefined);
      
      if (result.success) {
        setScraperStatus(`Success! Fetched from ${result.data.source}`);
        
        // Auto-fill the form with scraped data
        if (fSport === 'cricket' && result.data.teamA && result.data.teamB) {
          setScoreTeamARuns(result.data.teamA.runs?.toString() || '');
          setScoreTeamAWickets(result.data.teamA.wickets?.toString() || '');
          setScoreTeamAOvers(result.data.teamA.overs?.toString() || '');
          setScoreTeamBRuns(result.data.teamB.runs?.toString() || '');
          setScoreTeamBWickets(result.data.teamB.wickets?.toString() || '');
          setScoreTeamBOvers(result.data.teamB.overs?.toString() || '');
          setScoreMatchStatus(result.data.matchStatus || 'live');
          setScoreSource('scraper');
          
          // Update innings and batting team from scraper
          if (result.data.currentInnings) {
            setFInnings(result.data.currentInnings === 1 ? '1' : '2');
          }
          if (result.data.teamA.battingTeam !== undefined) {
            setFBattingTeam(result.data.teamA.battingTeam ? 'teamA' : 'teamB');
          }
          
          // Extract additional match details if available from direct URL scraping
          if (result.data.matchDateTime) {
            // Could update match time/venue info here
            console.log('[ControlPanel] Match DateTime:', result.data.matchDateTime);
          }
          if (result.data.venue) {
            console.log('[ControlPanel] Venue:', result.data.venue);
          }
          if (result.data.series) {
            console.log('[ControlPanel] Series:', result.data.series);
          }
        } else if (fSport === 'football' && result.data.teamA && result.data.teamB) {
          setScoreTeamARuns(result.data.teamA.goals?.toString() || '');
          setScoreTeamBRuns(result.data.teamB.goals?.toString() || '');
          setScoreMatchStatus(result.data.matchStatus || 'live');
          setScoreSource('scraper');
        }
        
        console.log('[ControlPanel] Scraper result:', result.data);
      } else {
        setScraperStatus(`Failed: ${result.error}`);
        console.error('[ControlPanel] Scraper error:', result);
        
        // Fallback: Try to use prediction data if scraper fails
        if (fSport === 'cricket') {
          try {
            const predictionsSnap = await getOnce(matchPredictionsRef(fSport, tournamentId, matchId));
            const predictions = predictionsSnap.val();
            
            if (predictions) {
              // Handle new array structure or old object structure
              const predictionsArray = Array.isArray(predictions.predictions) 
                ? predictions.predictions 
                : Object.values(predictions).filter((p: any) => p && typeof p === 'object');
              
              // Find a prediction that matches the current batting team
              const relevantPrediction = predictionsArray.find((p: any) => {
                if (meta?.status === 'scheduled') {
                  // For scheduled matches, allow predictions for both teams
                  return true; // No restriction - allow bidirectional predictions
                } else if (meta?.status === 'live') {
                  // For live matches, determine batting first from disableScore flags
                  const actualBattingFirst = meta?.disableScoreA === false ? 'teamA' : meta?.disableScoreB === false ? 'teamB' : null;
                  if (actualBattingFirst) {
                    return p.predictedBattingFirst === actualBattingFirst;
                  } else {
                    // If batting first cannot be determined, allow any prediction
                    return true;
                  }
                }
                return false;
              });
              
              if (relevantPrediction) {
                const predictionScoreStr = fBattingTeam === 'teamA' ? relevantPrediction.scoreA : relevantPrediction.scoreB;
                if (predictionScoreStr) {
                  // Parse score string like "185/4"
                  const parts = predictionScoreStr.split('/');
                  setScoreTeamARuns(fBattingTeam === 'teamA' ? parts[0] || '' : '');
                  setScoreTeamAWickets(fBattingTeam === 'teamA' ? parts[1] || '' : '');
                  setScoreTeamBRuns(fBattingTeam === 'teamB' ? parts[0] || '' : '');
                  setScoreTeamBWickets(fBattingTeam === 'teamB' ? parts[1] || '' : '');
                  setScraperStatus(`Using prediction data as fallback`);
                  setScoreSource('prediction');
                }
              }
            }
          } catch (e) {
            console.error('[ControlPanel] Error loading prediction fallback:', e);
          }
        }
      }
    } catch (error) {
      setScraperStatus('Error running scraper');
      console.error('[ControlPanel] Scraper exception:', error);
    } finally {
      setScraperRunning(false);
      setTimeout(() => setScraperStatus(''), 5000);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Scheduler Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const loadSchedulerTasks = async () => {
    if (!isFirebaseConfigured || !db) return;
    try {
      const snap = await getOnce(ref(db, getDbRoot() + '/scheduler_config/tasks'));
      const tasks = snap.val();
      if (tasks) {
        setSchedulerTasks(tasks);
      }
    } catch (error) {
      console.error('[ControlPanel] Error loading scheduler tasks:', error);
    }
  };

  const handleTriggerSchedulerTask = async (taskId: string) => {
    // @ts-ignore
    const result = await window.overlayDesktop.triggerSchedulerTask(taskId);
    if (result.success) {
      alert(`Task ${taskId} triggered successfully`);
      loadSchedulerTasks();
    } else {
      alert(`Failed to trigger task: ${result.error}`);
    }
  };

  const handleToggleSchedulerTask = async (taskId: string) => {
    // @ts-ignore
    const result = await window.overlayDesktop.toggleSchedulerTask(taskId);
    if (result.success) {
      loadSchedulerTasks();
    } else {
      alert(`Failed to toggle task: ${result.error}`);
    }
  };

  const handleUpdateSchedulerTask = async (taskId: string, config: any) => {
    // @ts-ignore
    const result = await window.overlayDesktop.updateSchedulerTask(taskId, config);
    if (result.success) {
      alert(`Task ${taskId} updated successfully`);
      loadSchedulerTasks();
    } else {
      alert(`Failed to update task: ${result.error}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Win Probability
  // ─────────────────────────────────────────────────────────────────────────────
  const performWinProbFetch = async () => {
    if (!googleUrl.trim()) { setFetchStatus('Status: No URL provided'); return; }
    setFetchStatus('Status: Fetching...');
    try {
      // @ts-ignore
      const result = await window.overlayDesktop.fetchWinProbability(googleUrl);
      if (result?.probA && result?.probB) {
        setFetchStatus(`Status: Success (${result.probA} / ${result.probB})`);
        if (isFirebaseConfigured && db && matchId && tournamentId) {
          await update(matchMetaRef(fSport, tournamentId, matchId), { 
            winProbabilityA: parseInt(result.probA), 
            winProbabilityB: parseInt(result.probB) 
          });
        }
      } else {
        setFetchStatus('Status: Failed (Widget not found)');
      }
    } catch {
      setFetchStatus('Status: Error (Check console)');
    }
  };

  const handleShowWinProbToggle = async (v: boolean) => {
    setShowWinProb(v);
    if (isFirebaseConfigured && db && matchId && tournamentId) {
      await update(matchMetaRef(fSport, tournamentId, matchId), { showWinProb: v });
    }
  };

  const handleGoogleUrlSave = async () => {
    if (isFirebaseConfigured && db && matchId && tournamentId) {
      await update(matchMetaRef(fSport, tournamentId, matchId), { googleMatchUrl: googleUrl.trim() });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Overlay Controls
  // ─────────────────────────────────────────────────────────────────────────────
  const updateS = async (partial: any) => {
    // @ts-ignore
    const s = await window.overlayDesktop.updateSettings(partial);
    setSettings(s);
    if (partial.opacity !== undefined) setOpacity(partial.opacity);
    if (partial.reactionOpacity !== undefined) setReactionOpacity(partial.reactionOpacity);
    return s;
  };

  const handleClear = async (node: string) => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    if (!confirm(`Clear ALL ${node} for match ${matchId}?`)) return;
    try { 
      const nodeRef = matchRef(fSport, tournamentId, matchId, node);
      await update(nodeRef, {}); 
    } catch (err) { console.error(err); }
  };

  const togglePredictionPause = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    const next = !Boolean(meta.predictionsPaused);
    await update(matchMetaRef(fSport, tournamentId, matchId), { predictionsPaused: next });
    // @ts-ignore
    await window.overlayDesktop.reloadOverlay();
  };

  const toggleHideChat = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    await update(matchMetaRef(fSport, tournamentId, matchId), { hideChat: !Boolean(meta.hideChat) });
  };

  const toggleHideJoin = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    await update(matchMetaRef(fSport, tournamentId, matchId), { hideJoin: !Boolean(meta.hideJoin) });
  };

  const toggleSortMode = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    const next = (meta.predictionSort || 'newest') === 'newest' ? 'score' : 'newest';
    await update(matchMetaRef(fSport, tournamentId, matchId), { predictionSort: next });
    // @ts-ignore
    await window.overlayDesktop.reloadOverlay();
  };

  const loadTodayMatch = async () => {
    // @ts-ignore
    const csv = await window.overlayDesktop.getScheduleCsv();
    if (!csv) { alert("Could not load schedule CSV."); return; }
    const lines = csv.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const todayStr = `${dd}-${mm}-${now.getFullYear()}`;
    const match = lines.slice(1).map((line: string) => {
      const p = line.split(',');
      return p.length >= 6 ? { matchNo: p[0], date: p[1], home: p[3], away: p[4], titleStr: p[5].trim() } : null;
    }).find((m: any) => m?.date === todayStr);
    if (!match) { alert(`No matches for today (${todayStr}).`); return; }
    setFMatchTitle(match.titleStr); setFTeamA(match.home); setFTeamB(match.away);
    setFBattingTeam('teamA'); setFInnings('1');
    alert(`Loaded ${match.titleStr}. Click "Deploy Changes" to apply.`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Resolution
  // ─────────────────────────────────────────────────────────────────────────────
  const [forceReprocess, setForceReprocess] = useState(false);

  const resolveMatch = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    
    let actualVal: any;
    let actualWinner = '';

    if (is2nd) {
      const tA = (fTeamA || 'Team A').toLowerCase();
      const tB = (fTeamB || 'Team B').toLowerCase();
      let chase = tB;
      if (meta.disableScoreA && !meta.disableScoreB) chase = tB;
      else if (meta.disableScoreB && !meta.disableScoreA) chase = tA;
      const defend = chase === tA ? tB : tA;
      actualWinner = fChaserWon === 'yes' ? chase : defend;
      actualVal = fActualResult.trim();
      if (!actualVal) { alert('Enter the actual result (Overs or Score).'); return; }
    } else {
      actualVal = parseInt(fActualScore);
      if (isNaN(actualVal) || actualVal < 1) { alert('Enter a valid 1st innings score.'); return; }
    }

    try {
      // Save actual result to Firebase meta
      if (is2nd) {
        // Mark match as done when resolving 2nd innings (final resolution)
        await update(matchMetaRef(fSport, tournamentId, matchId), {
          actual2ndInningsResult: actualVal,
          actualWinner: actualWinner,
          isOversFormat: fChaserWon === 'yes',
          status: 'done',
          endedAt: Date.now()
        });
      } else {
        await update(matchMetaRef(fSport, tournamentId, matchId), {
          actual1stInningsScore: actualVal
        });
      }

      // Trigger Python resolution
      if (typeof window !== 'undefined' && (window as any).overlayDesktop) {
        setResolutionStatus('running');
        setResolutionMessage('Calculating scores via Python...');
        
        // Pass innings parameter to Python script
        const inningsParam = is2nd ? '2' : '1';
        const result = await (window as any).overlayDesktop.processMatchResolution(fSport, tournamentId, matchId, inningsParam, forceReprocess, firebaseMode);
        
        if (result.success) {
          setResolutionStatus('success');
          setResolutionMessage(`Scores calculated successfully. ${result.lineCount || 0} lines processed.`);
          
          // Fetch reconciled predictions to populate results
          try {
            const predictionsSnap = await getOnce(matchPredictionsRef(fSport, tournamentId, matchId));
            const predictions = predictionsSnap.val();
            
            if (predictions) {
              const results = Object.entries(predictions).map(([username, data]: [string, any]) => {
                const prediction = data.first_inn || data.second_inn || data.early_predict?.first || data.early_predict?.second;
                return {
                  clientId: username,
                  name: username,
                  points: prediction?.score || 0,
                  guess: prediction?.runs || prediction?.runsOrOvers || prediction?.guess || '-',
                  diff: prediction?.diff || '-',
                  isExact: prediction?.isExact || false
                };
              }).sort((a, b) => b.points - a.points);
              
              setLastResults(results);
              setResActualScore(is2nd ? fActualResult : fActualScore);
            }
          } catch (fetchError) {
            console.error('[ControlPanel] Error fetching reconciled predictions:', fetchError);
          }
          
          // Refresh predictions to show reconciled results
          // @ts-ignore
          setResultsOpen(true);
          
          setTimeout(() => {
            setResolutionStatus('idle');
            setResolutionMessage('');
          }, 5000);
        } else {
          setResolutionStatus('error');
          setResolutionMessage(`Error: ${result.error}`);
          setTimeout(() => {
            setResolutionStatus('idle');
            setResolutionMessage('');
          }, 10000);
        }
      } else {
        alert('Python resolution only available in Electron app');
      }
    } catch (err) {
      console.error(err);
      alert('Error resolving match.');
    }
  };

  const handlePrepNext = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    const label = is2nd ? '2nd' : '1st';
    if (!confirm(`Finalize ${label} innings and archive results?`)) return;
    try {
      if (lastResults.length > 0) {
        const payload: Record<string, any> = {};
        lastResults.forEach(r => { payload[r.clientId || `legacy-${r.name}`] = { name: r.name, points: r.points, guess: r.guess, predictedWinner: r.originalPrediction?.predictedWinner || '' }; });
        await update(matchRef(fSport, tournamentId, matchId, `innings_history/${label}`), payload);
      }
      await update(matchPredictionsRef(fSport, tournamentId, matchId), {});
      if (!is2nd) {
        await update(matchMetaRef(fSport, tournamentId, matchId), { secondInnings: true, disableScoreA: true, disableScoreB: false });
        setFInnings('2');
      } else {
        await update(matchMetaRef(fSport, tournamentId, matchId), { secondInnings: false, disableScoreA: false, disableScoreB: true });
        setFInnings('1');
      }
      setLastResults([]);
      setFActualScore(''); setFActualResult('');
    } catch (err) { console.error(err); alert('Error finalizing stage.'); }
  };

  const viewFinalStandings = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    try {
      const h1Snap = await getOnce(matchRef(fSport, tournamentId, matchId, 'innings_history/1st'));
      const h2Snap = await getOnce(matchRef(fSport, tournamentId, matchId, 'innings_history/2nd'));
      const h1 = h1Snap.val() || {}; const h2 = h2Snap.val() || {};
      if (!Object.keys(h1).length && !Object.keys(h2).length) { alert('No innings data found yet.'); return; }
      const overall = calcMatchFinals(h1, h2).sort((a, b) => b.total - a.total);
      setLastOverall(overall);
      setOverallOpen(true);
    } catch (err) { console.error(err); alert('Error fetching standings.'); }
  };

  const handleEndMatch = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    if (!confirm('End match? This will trigger Python resolution to calculate scores and update leaderboard.')) return;
    
    // First, mark match as done
    try {
      await update(matchMetaRef(fSport, tournamentId, matchId), { status: 'done', endedAt: Date.now() });
    } catch (err) {
      console.error(err);
      alert('Error marking match as done.');
      return;
    }
    
    // Then trigger Python resolution
    if (typeof window !== 'undefined' && (window as any).overlayDesktop) {
      try {
        // Use 'both' innings for final resolution to calculate total and update tournament leaderboard
        const result = await (window as any).overlayDesktop.processMatchResolution(fSport, tournamentId, matchId, 'both');
        if (result.success) {
          setOverallOpen(false);
          setResultsOpen(false);
          setFActualScore(''); setFActualResult('');
          alert('Match ended and processed successfully. Scores and leaderboard updated.');
        } else {
          alert(`Error processing match: ${result.error}`);
        }
      } catch (err) {
        console.error('Error triggering Python resolution:', err);
        alert('Failed to trigger Python resolution');
      }
    } else {
      alert('Python resolution only available in Electron app');
    }
  };

  const handleRestoreMatch = async (matchIdToRestore: string) => {
    if (!isFirebaseConfigured || !db || !tournamentId) return;
    if (!confirm('Restore match to live status? This will allow users to join again.')) return;
    try {
      await update(matchMetaRef(fSport, tournamentId, matchIdToRestore), {
        status: 'live',
        autoMarked: false,
        autoMarkReason: null,
        endedAt: null
      });
      // Update local status
      setMatchStatuses(prev => ({ ...prev, [matchIdToRestore]: 'live' }));
      alert('Match restored to live status.');
    } catch (err) {
      console.error(err);
      alert('Error restoring match.');
    }
  };

  const updateSeasonLeaderboard = async (rid: string) => {
    const history = await getHistory(fSport, rid);
    const seasonMap = new Map<string, any>();
    Object.values(history).forEach((match: any) => {
      (match.finalStandings || []).forEach((r: any) => {
        const key = r.name.trim().toLowerCase();
        if (!seasonMap.has(key)) seasonMap.set(key, { name: r.name, total: 0, matchCount: 0 });
        const p = seasonMap.get(key); p.total += r.total || 0; p.matchCount += 1;
      });
    });
    const players = Array.from(seasonMap.values()).map(p => ({ ...p, ppg: +(p.total / (p.matchCount || 1)).toFixed(2) }));
    await saveSeasonLeaderboard(fSport, rid, players.sort((a, b) => b.total - a.total));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // History
  // ─────────────────────────────────────────────────────────────────────────────
  const openHistory = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    setHistoryOpen(true);
    try {
      const hSnap = await getOnce(matchRef(fSport, tournamentId, matchId, 'history'));
      const h = hSnap.val() || {};
      setFullHistory(h);
      showSeasonStats(h);
    } catch (err) { console.error(err); }
  };

  const showSeasonStats = (h?: Record<string, any>) => {
    const history = h || fullHistory;
    if (!history || !Object.keys(history).length) { return; }
    const totals = new Map<string, any>();
    Object.values(history).forEach((match: any) => {
      (match.finalStandings || []).forEach((r: any) => {
        const key = r.name.trim().toLowerCase();
        if (!totals.has(key)) totals.set(key, { name: r.name, total: 0, matches: 0 });
        const p = totals.get(key); p.total += r.total || 0; p.matches += 1;
      });
    });
  };

  const selectMatch = (key: string) => {
    const match = fullHistory[key];
    if (!match) return;
    setActiveHistoryKey(key);
    const buildTable = (data: Record<string, any>, title: string) => {
      const rows = Object.values(data).sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
      return (
        <div className="history-section" key={title}>
          <div className="history-section-title">{title}</div>
          <table className="results-table">
            <thead><tr><th>Name</th><th>Guess</th><th>Points</th></tr></thead>
            <tbody>{rows.map((r: any) => <tr key={r.name}><td style={{ fontWeight: 700 }}>{r.name}</td><td>{r.guess}</td><td style={{ fontWeight: 800 }}>{r.points}</td></tr>)}</tbody>
          </table>
        </div>
      );
    };
    const finals = [...(match.finalStandings || [])].sort((a: any, b: any) => (b.total || 0) - (a.total || 0));
    setHistoryDetail(
      <div className="history-grid">
        <div className="history-section">
          <div className="history-section-title">Final Match Standings</div>
          <table className="results-table">
            <thead><tr><th>Name</th><th>1st Inn</th><th>2nd Inn</th><th>Penalty</th><th>Total</th></tr></thead>
            <tbody>{finals.map((r: any) => <tr key={r.name}><td style={{ fontWeight: 700 }}>{r.name}</td><td>{r.p1Score}</td><td>{r.p2Score}</td><td>{r.penalty}</td><td style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent-blue)' }}>{r.total}</td></tr>)}</tbody>
          </table>
        </div>
        {buildTable(match.innings1 || {}, '1st Innings Rankings')}
        {buildTable(match.innings2 || {}, '2nd Innings Rankings')}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Manual Entry
  // ─────────────────────────────────────────────────────────────────────────────
  const addManualRow = () => setManRows(r => [...r, { name: '', p1Guess: '', win1: 'a', p2Guess: '', win2: 'a' }]);
  const updateManRow = (i: number, key: string, val: any) => setManRows(r => r.map((row, idx) => idx === i ? { ...row, [key]: val } : row));
  const removeManRow = (i: number) => setManRows(r => r.filter((_, idx) => idx !== i));

  const saveManualMatch = async () => {
    const rid = normalizeRoomId(fRoomId || roomId);
    if (!manDate || !manTitle || isNaN(Number(manActual1st)) || !manActual2nd) { alert('Fill all match setup fields.'); return; }
    if (!manRows.length) { alert('Add at least one player.'); return; }
    const tA = manTeamA || 'Team A'; const tB = manTeamB || 'Team B';
    const actualWinner = (manWinner === 'a' ? tA : tB).toLowerCase();
    const meta1 = { teamA: tA, teamB: tB, disableScoreA: false, disableScoreB: true };
    const meta2 = { teamA: tA, teamB: tB, disableScoreA: true, disableScoreB: false };
    const isOvers = manActual2nd.includes('.');
    const innings1: Record<string, any> = {};
    const innings2: Record<string, any> = {};
    manRows.forEach((row, i) => {
      const name = row.name.trim() || `Player ${i + 1}`;
      const predW1 = row.win1 === 'a' ? tA : tB;
      const predW2 = row.win2 === 'a' ? tA : tB;
      const p1 = calcInnings1Points({ scoreA: row.p1Guess, predictedWinner: predW1 }, Number(manActual1st), meta1);
      innings1[name] = { name, ...p1, points: p1.points, guess: row.p1Guess, predictedWinner: predW1 };
      const p2 = calcInnings2Points({ scoreA: row.p2Guess, scoreB: row.p2Guess, predictedWinner: predW2 }, actualWinner, manActual2nd, meta2, isOvers);
      innings2[name] = { name, ...p2, points: p2.points, guess: row.p2Guess, predictedWinner: predW2 };
    });
    const finalStandings = calcMatchFinals(innings1, innings2);
    const dateKey = `${manDate.replace(/[^a-zA-Z0-9]/g, '-')}_MANUAL_${Date.now()}`;
    await archiveToHistory(fSport, rid, dateKey, { matchTitle: manTitle, teamA: tA, teamB: tB, innings1, innings2, finalStandings, matchResults: { actual1st: Number(manActual1st), actual2nd: manActual2nd, actualWinner } });
    alert('Manual Match Archived!');
    setManualOpen(false);
    await updateSeasonLeaderboard(rid);
  };

  const openEditMatch = (key: string) => {
    const match = fullHistory[key];
    if (!match) return;
    const res = match.matchResults || {};
    const dateStr = key.split('_')[0];
    setEditKey(key); setEditMatchTitle(match.matchTitle || ''); setEditMatchDate(dateStr);
    setEditTeamA(match.teamA || ''); setEditTeamB(match.teamB || '');
    setEditActual1st(String(res.actual1st || '')); setEditActual2nd(res.actual2nd || '');
    const w = (res.actualWinner || '').toLowerCase();
    setEditWinner(w === (match.teamA || '').toLowerCase() ? 'a' : 'b');
    setEditOpen(true);
  };

  const saveEditedMatch = async () => {
    if (!editKey) return;
    const rid = normalizeRoomId(fRoomId || roomId);
    const tA = editTeamA.trim(); const tB = editTeamB.trim();
    const actual1st = Number(editActual1st);
    const actual2nd = editActual2nd.trim();
    const actualWinner = (editWinner === 'a' ? tA : tB).toLowerCase();
    if (!editMatchTitle || !editMatchDate || !tA || !tB || isNaN(actual1st) || !actual2nd) { alert('Fill all fields.'); return; }
    const orig = fullHistory[editKey];
    if (!orig) return;
    const snap = JSON.parse(JSON.stringify(orig));
    snap.matchTitle = editMatchTitle; snap.teamA = tA; snap.teamB = tB;
    snap.matchResults = { actual1st, actual2nd, actualWinner };
    const oldA = (orig.teamA || '').toLowerCase(); const oldB = (orig.teamB || '').toLowerCase();
    const normalize = (p: any) => {
      let w = (p.predictedWinner || '').toLowerCase();
      if (w === oldA) w = tA.toLowerCase(); else if (w === oldB) w = tB.toLowerCase();
      return { scoreA: p.guess, scoreB: p.guess, predictedWinner: w };
    };
    const meta1 = { teamA: tA, teamB: tB, disableScoreA: false, disableScoreB: true };
    const meta2 = { teamA: tA, teamB: tB, disableScoreA: true, disableScoreB: false };
    const isOvers = actual2nd.includes('.');
    if (snap.innings1) Object.keys(snap.innings1).forEach(pid => { const stats = calcInnings1Points(normalize(snap.innings1[pid]), actual1st, meta1); snap.innings1[pid] = { ...snap.innings1[pid], ...stats }; });
    if (snap.innings2) Object.keys(snap.innings2).forEach(pid => { const stats = calcInnings2Points(normalize(snap.innings2[pid]), actualWinner, actual2nd, meta2, isOvers); snap.innings2[pid] = { ...snap.innings2[pid], ...stats }; });
    snap.finalStandings = calcMatchFinals(snap.innings1 || {}, snap.innings2 || {});
    const oldKey = editKey;
    const newKey = `${editMatchDate}_${oldKey.split('_')[1] || Date.now()}`;
    if (oldKey !== newKey) { 
      await archiveToHistory(fSport, rid, newKey, snap); 
      await clearRoomNode(fSport, rid, `history/${oldKey}`); 
    }
    else await archiveToHistory(fSport, rid, oldKey, snap);
    await updateSeasonLeaderboard(rid);
    const h = await getHistory(fSport, rid);
    setFullHistory(h || {});
    setEditOpen(false);
    alert('Match updated and points recalculated!');
    selectMatch(newKey);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Audience URL
  // ─────────────────────────────────────────────────────────────────────────────
  const openAudienceUrl = () => {
    const url = getAudienceUrl(roomId, matchId);
    // @ts-ignore
    window.overlayDesktop.openExternal(url);
  };

  const copyAudienceUrl = async () => {
    try {
      const url = getAudienceUrl(roomId, matchId);
      // @ts-ignore
      await window.overlayDesktop.copyText(url);
      alert('Link copied to clipboard!');
    } catch (err) { console.error(err); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Results CSV exports
  // ─────────────────────────────────────────────────────────────────────────────
  const downloadCSV = () => {
    if (!lastResults.length) return;
    const rows = lastResults.map((r, i) => [i + 1, r.name, r.guess, r.diff, r.points].join(','));
    const csv = ['Rank,Name,Guess,Diff,Points', ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `Innings_Results_${new Date().toLocaleDateString()}.csv`; a.click();
  };

  const downloadOverallCSV = () => {
    if (!lastOverall.length) return;
    const rows = lastOverall.map((r, i) => [i + 1, r.name, r.p1Score, r.p2Score, r.penalty, r.total].join(','));
    const csv = ['Rank,Name,1st Inn Pts,2nd Inn Pts,Penalty,Total', ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `FullMatch_Standings_${new Date().toLocaleDateString()}.csv`; a.click();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  const predPaused = Boolean(meta.predictionsPaused);
  const sortMode = meta.predictionSort || 'newest';
  const chatHidden = Boolean(meta.hideChat);
  const joinHidden = Boolean(meta.hideJoin);

  return (
    <div className="cp-shell">
      <div className="ambient ambient-left"></div>
      <div className="ambient ambient-right"></div>
      
      {/* ── Action Feedback Component ── */}
      {actionFeedback.type && (
        <div 
          className={`action-feedback ${actionFeedback.type}`}
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: '12px 16px',
            borderRadius: '8px',
            background: actionFeedback.type === 'success' ? 'var(--system-green)' : 
                        actionFeedback.type === 'error' ? 'var(--system-red)' : 
                        actionFeedback.type === 'warning' ? '#ff9f0a' : 
                        'var(--system-blue)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxWidth: '300px',
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          <div style={{ fontWeight: '700', marginBottom: '4px' }}>
            {actionFeedback.type === 'success' ? '✓ Success' : 
             actionFeedback.type === 'error' ? '✗ Error' : 
             actionFeedback.type === 'warning' ? '⚠ Warning' : 
             'ℹ Info'}
          </div>
          <div>{actionFeedback.message}</div>
          {actionFeedback.details && (
            <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
              {actionFeedback.details}
            </div>
          )}
        </div>
      )}
      
      {/* ── Action Log Toggle (for debugging) ── */}
      <div 
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9998
        }}
      >
        <button
          onClick={() => setShowActionLog(!showActionLog)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            fontSize: '12px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)'
          }}
        >
          {showActionLog ? 'Hide' : 'Show'} Action Log ({actionHistory.length})
        </button>
      </div>
      
      {/* ── Action Log Panel ── */}
      {showActionLog && (
        <div 
          style={{
            position: 'fixed',
            top: 80,
            right: 20,
            width: '400px',
            height: '300px',
            background: 'rgba(5, 7, 10, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            zIndex: 9997,
            padding: '16px',
            overflow: 'auto',
            backdropFilter: 'blur(20px)'
          }}
        >
          <div style={{ fontWeight: '700', marginBottom: '12px', color: 'white' }}>
            Action History (Last 100)
          </div>
          {actionHistory.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No actions logged yet</div>
          ) : (
            actionHistory.map((entry, index) => (
              <div 
                key={index} 
                style={{
                  marginBottom: '8px',
                  padding: '8px',
                  background: entry.success ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                  border: `1px solid ${entry.success ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`,
                  borderRadius: '4px',
                  fontSize: '11px'
                }}
              >
                <div style={{ 
                  fontWeight: '600', 
                  color: entry.success ? 'var(--system-green)' : 'var(--system-red)',
                  marginBottom: '2px'
                }}>
                  {entry.success ? '✓' : '✗'} {entry.action}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '10px' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                  {entry.details && ` • ${entry.details}`}
                </div>
                {entry.firebaseCalls && entry.firebaseCalls.length > 0 && (
                  <div style={{ color: 'var(--system-blue)', fontSize: '10px', marginTop: '2px' }}>
                    Firebase calls: {entry.firebaseCalls.length}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      
      {/* ── Header ── */}
      <header className="cp-header">
        <div className="cp-header-main">
          <div className="cp-header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="cp-badge">Executive</span>
              <span className="cp-badge" style={{ 
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}>
                {fSport ? fSport.toUpperCase() : 'NO SPORT'}
              </span>
              <div className="firebase-mode-toggle">
                <button 
                  className={`mode-btn ${firebaseMode === 'local' ? 'active' : ''}`}
                  onClick={() => handleFirebaseModeSwitch('local')}
                >
                  <div className="mode-btn-content">
                    <span className="mode-name">Local</span>
                    <span className="mode-code">dev</span>
                  </div>
                  <span className="mode-indicator"></span>
                </button>
                <button 
                  className={`mode-btn ${firebaseMode === 'prod' ? 'active' : ''}`}
                  onClick={() => handleFirebaseModeSwitch('prod')}
                >
                  <div className="mode-btn-content">
                    <span className="mode-name">Production</span>
                    <span className="mode-code">prod</span>
                  </div>
                  <span className="mode-indicator"></span>
                </button>
              </div>
            <h1>Control Panel</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ margin: 0 }}>
                {fMatchTitle ? (
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fMatchTitle}</span>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>No match selected</span>
                )}
              </p>
              {matchId && (
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                  Match ID: <span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{matchId}</span>
                  {fTeamA && fTeamB && (
                    <span> • {fTeamA} vs {fTeamB}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="cp-header-controls" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => {
                // @ts-ignore
                window.overlayDesktop.showDebug();
              }}
              className="cp-action-btn cp-small"
              style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.2)' }}
            >
              Debug
            </button>
            <button className="cp-action-btn cp-pill" onClick={openHistory}>
              <span>📚</span> History
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>MATCH CODE</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: '0.01em', fontFamily: 'monospace' }}>
              {matchId || 'No match selected'}
            </span>
          </div>
          <button className="cp-primary-btn cp-small" onClick={copyAudienceUrl}>
            Share Link
          </button>
        </div>
        </div>
      </header>

      <div className="cp-content-grid">

        {/* ── Tournament Management ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('tournament')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>Tournament Management</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.tournament ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card" style={{ display: collapsedSections.tournament ? 'none' : 'block' }}>
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
                      onClick={() => handleSelectTournament(t)}
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
                onClick={() => handleTabChange('details')}
                className={`cp-action-btn cp-small ${tournamentTab === 'details' ? 'cp-active' : ''}`}
                style={{ flex: 1 }}
              >
                Tournament Details
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('schedule')}
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
                        <input type="radio" id="statusActive" name="tournamentStatus" value="active" checked={tournamentStatus === 'active'} onChange={() => handleUpdateTournamentStatus('active')} />
                        <label className="cp-radio-label" htmlFor="statusActive">Active</label>
                      </div>
                      <div className="cp-radio-option">
                        <input type="radio" id="statusPaused" name="tournamentStatus" value="paused" checked={tournamentStatus === 'paused'} onChange={() => handleUpdateTournamentStatus('paused')} />
                        <label className="cp-radio-label" htmlFor="statusPaused">Paused</label>
                      </div>
                      <div className="cp-radio-option">
                        <input type="radio" id="statusEnded" name="tournamentStatus" value="ended" checked={tournamentStatus === 'ended'} onChange={() => handleUpdateTournamentStatus('ended')} />
                        <label className="cp-radio-label" htmlFor="statusEnded">Ended</label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="cp-divider" />

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="cp-primary-btn" style={{ flex: 1 }} type="button" onClick={handleCreateTournament as any}>
                    {tournamentId ? 'Update Tournament' : 'Create Tournament'}
                  </button>
                  {tournamentId && (
                    <button 
                      className="cp-secondary-btn cp-danger" 
                      type="button"
                      onClick={handleDeleteTournament}
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
                        onChange={handleCSVUpload}
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
                                onClick={() => handleLoadMatchFromSchedule(match)}
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
                        onClick={async () => {
                          const loadedSchedule = await getTournamentSchedule(fSport, tournamentId);
                          setEditingSchedule(loadedSchedule);
                          setShowScheduleEditor(true);
                        }}
                        className="cp-primary-btn"
                        style={{ flex: 1 }}
                      >
                        Edit Schedule
                      </button>
                      <button 
                        type="button"
                        onClick={async () => {
                          if (!confirm('Clear all matches from schedule?')) return;
                          await saveTournamentSchedule(fSport, tournamentId, []);
                          setSchedule([]);
                          setEditingSchedule([]);
                          alert('Schedule cleared');
                        }}
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
        </section>

        {/* ── Match Management ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('match')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>Match Management</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.match ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card" style={{ display: collapsedSections.match ? 'none' : 'block' }}>
            <div style={{ 
              padding: '12px 16px', 
              background: 'rgba(52, 199, 89, 0.1)', 
              borderRadius: '8px', 
              border: '1px solid rgba(52, 199, 89, 0.2)', 
              marginBottom: '16px',
              fontSize: '12px',
              color: 'var(--muted)'
            }}>
              <strong>⚽ What this section does:</strong> Create individual matches, set match details, configure prediction settings, and manage live scores. Updates here affect the current match only.
            </div>
            {/* Tournament Selection Warning */}
            {!tournamentId && (
              <div style={{ padding: '16px', background: 'rgba(255, 159, 10, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 159, 10, 0.3)', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#ff9f0a', fontWeight: '600' }}>
                  ⚠️ Please select a tournament first to manage matches
                </span>
              </div>
            )}

            {tournamentId && (
              <>
                {/* Schedule View */}
                {schedule.length > 0 && (
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Next Scheduled Match</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          type="button"
                          onClick={async () => {
                            const loadedSchedule = await getTournamentSchedule(fSport, tournamentId);
                            setSchedule(loadedSchedule);
                          }}
                          className="cp-action-btn cp-small"
                          style={{ fontSize: '10px' }}
                        >
                          Refresh
                        </button>
                        <button 
                          type="button"
                          onClick={handleOpenScheduleEditor}
                          className="cp-action-btn cp-small"
                          style={{ fontSize: '10px' }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {schedule
                        .filter((match: any) => {
                          // Only show matches that are scheduled with a date
                          if (!match.date) return false;
                          const matchDate = new Date(match.date);
                          const now = new Date();
                          // Compare date parts only (year, month, day) - ignore time for filtering
                          const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
                          const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          // Show today's matches and future matches
                          return matchDateOnly >= nowDateOnly;
                        })
                        .sort((a: any, b: any) => {
                          // Sort by full date/time to get the next upcoming match
                          return new Date(a.date).getTime() - new Date(b.date).getTime();
                        })
                        .slice(0, 1) // Only show the best candidate (next upcoming match)
                        .map((match, idx) => {
                          const now = new Date();
                          const matchDate = match.date ? new Date(match.date) : null;
                          const isUpcoming = matchDate && matchDate >= now;
                          const isSelected = fMatchTitle === match.matchTitle && fTeamA === match.teamA && fTeamB === match.teamB;
                          const matchStatus = matchStatuses[match.matchId] || 'scheduled';
                          
                          // Calculate days until match
                          let statusText = '';
                          let statusColor = '';
                          let statusBg = '';
                          
                          // Priority: match status > date-based status
                          if (matchStatus === 'live') {
                            statusText = 'LIVE';
                            statusColor = '#ef4444';
                            statusBg = 'rgba(239, 68, 68, 0.2)';
                          } else if (matchStatus === 'done') {
                            statusText = 'DONE';
                            statusColor = '#8e8e93';
                            statusBg = 'rgba(142, 142, 147, 0.2)';
                          } else if (matchDate) {
                            const diffTime = matchDate.getTime() - now.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            if (diffDays === 0) {
                              statusText = 'TODAY';
                              statusColor = '#ff9f0a';
                              statusBg = 'rgba(255, 159, 10, 0.2)';
                            } else if (diffDays === 1) {
                              statusText = 'TOMORROW';
                              statusColor = '#34c759';
                              statusBg = 'rgba(52, 199, 89, 0.2)';
                            } else {
                              statusText = `IN ${diffDays} DAYS`;
                              statusColor = '#34c759';
                              statusBg = 'rgba(52, 199, 89, 0.15)';
                            }
                          } else {
                            statusText = 'SCHEDULED';
                            statusColor = '#8e8e93';
                            statusBg = 'rgba(142, 142, 147, 0.15)';
                          }
                          
                          return (
                            <div 
                              key={idx}
                              style={{ 
                                padding: '10px', 
                                background: isSelected ? 'rgba(0, 122, 255, 0.15)' : (matchStatus === 'live' ? 'rgba(239, 68, 68, 0.05)' : (matchStatus === 'done' ? 'rgba(142, 142, 147, 0.05)' : (isUpcoming ? 'rgba(52, 199, 89, 0.05)' : 'rgba(255,255,255,0.05)'))), 
                                borderRadius: '6px',
                                border: isSelected ? '1px solid var(--accent-blue)' : (matchStatus === 'live' ? '1px solid rgba(239, 68, 68, 0.3)' : (matchStatus === 'done' ? '1px solid rgba(142, 142, 147, 0.2)' : (isUpcoming ? '1px solid rgba(52, 199, 89, 0.2)' : '1px solid rgba(255,255,255,0.08)'))),
                                fontSize: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {match.matchTitle}
                                  <span style={{ fontSize: '9px', background: statusBg, color: statusColor, padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{statusText}</span>
                                  {isSelected && <span style={{ fontSize: '9px', background: 'rgba(0, 122, 255, 0.2)', color: '#007aff', padding: '2px 6px', borderRadius: '4px' }}>SELECTED</span>}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{match.date || 'TBD'} • {match.venue || ''}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleLoadMatchFromSchedule(match)}
                                className="cp-action-btn cp-small"
                                style={{ fontSize: '10px', padding: '4px 8px' }}
                              >
                                {isSelected ? 'Selected' : 'Load'}
                              </button>
                            </div>
                          );
                        })}
                      {schedule.filter((m: any) => {
                        if (!m.date) return false;
                        const matchDate = new Date(m.date);
                        const now = new Date();
                        const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
                        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        return matchDateOnly >= nowDateOnly;
                      }).length === 0 && (
                        <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', textAlign: 'center', color: 'var(--muted)' }}>
                          No upcoming scheduled matches
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Existing Matches */}
                {availableMatches.length > 0 && (
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Existing Matches ({availableMatches.length})</span>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {availableMatches.map((match) => (
                        <div 
                          key={match.matchId}
                          style={{ 
                            padding: '10px', 
                            background: matchId === match.matchId ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255,255,255,0.05)', 
                            borderRadius: '6px',
                            border: matchId === match.matchId ? '1px solid var(--accent-blue)' : '1px solid rgba(255,255,255,0.08)',
                            fontSize: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text)' }}>{match.matchTitle}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{match.teamA} vs {match.teamB}</div>
                            <div style={{ marginTop: '4px' }}>
                              <span 
                                style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  background: matchStatuses[match.matchId] === 'live' 
                                    ? 'rgba(239, 68, 68, 0.2)' 
                                    : matchStatuses[match.matchId] === 'done' 
                                      ? 'rgba(142, 142, 147, 0.2)' 
                                      : 'rgba(52, 199, 89, 0.2)',
                                  color: matchStatuses[match.matchId] === 'live' 
                                    ? '#ef4444' 
                                    : matchStatuses[match.matchId] === 'done' 
                                      ? '#8e8e93' 
                                      : '#34c759',
                                  fontWeight: '600'
                                }}
                              >
                                {(matchStatuses[match.matchId] || 'scheduled').toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {matchStatuses[match.matchId] === 'done' && (
                              <button
                                type="button"
                                onClick={() => handleRestoreMatch(match.matchId)}
                                className="cp-action-btn cp-small"
                                style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(52, 199, 89, 0.2)', color: '#34c759' }}
                              >
                                Restore
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSelectMatch(match)}
                              className="cp-action-btn cp-small"
                              style={{ fontSize: '10px', padding: '4px 8px' }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMatch(match.matchId)}
                              className="cp-action-btn cp-small cp-danger"
                              style={{ fontSize: '10px', padding: '4px 8px' }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="cp-divider" />

                {/* Match Tabs */}
                <div className="cp-tabs">
                  <button 
                    className={`cp-tab ${activeMatchTab === 'details' ? 'active' : ''}`}
                    onClick={() => setActiveMatchTab('details')}
                  >
                    <span className="cp-tab-icon">📋</span>
                    Match Details
                  </button>
                  <button 
                    className={`cp-tab-btn ${activeMatchTab === 'live' ? 'active' : ''}`}
                    onClick={() => setActiveMatchTab('live')}
                  >
                    <span className="cp-tab-icon">📊</span>
                    Match Control
                  </button>
                </div>

                {/* Match Details Tab */}
                <div className={`cp-tab-content ${activeMatchTab === 'details' ? 'active' : ''}`}>
                  <form onSubmit={handleCreateMatch}>
                    <div className="cp-form-row">
                      <label>Tournament</label>
                      <input value={tournamentId} readOnly style={{ background: 'rgba(255,255,255,0.02)', cursor: 'not-allowed' }} />
                    </div>
                    <div className="cp-dual-row">
                      <div className="cp-form-row">
                        <label>Match Code</label>
                        <input value={fMatchCode} onChange={e => setFMatchCode(e.target.value)} maxLength={40} placeholder="e.g. csk-vs-mi" required />
                      </div>
                      <div className="cp-form-row">
                        <label>Match Title</label>
                        <input value={fMatchTitle} onChange={e => setFMatchTitle(e.target.value)} placeholder="e.g. CSK vs MI - Match 1" required />
                      </div>
                    </div>
                    <div className="cp-dual-row">
                      <div className="cp-form-row">
                        <label>Home Team</label>
                        <div className="cp-input-action-group">
                          <input value={fTeamA} onChange={e => setFTeamA(e.target.value)} maxLength={30} placeholder="Team A" required />
                          {getTeamLogoUrl(fTeamA, '../desktop/assets/team-logos') && (
                            <img 
                              src={getTeamLogoUrl(fTeamA, '../desktop/assets/team-logos')!} 
                              alt={fTeamA}
                              style={{ width: 40, height: 40, objectFit: 'contain', padding: 4 }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="cp-form-row">
                        <label>Away Team</label>
                        <div className="cp-input-action-group">
                          <input value={fTeamB} onChange={e => setFTeamB(e.target.value)} maxLength={30} placeholder="Team B" required />
                          {getTeamLogoUrl(fTeamB, '../desktop/assets/team-logos') && (
                            <img 
                              src={getTeamLogoUrl(fTeamB, '../desktop/assets/team-logos')!} 
                              alt={fTeamB}
                              style={{ width: 40, height: 40, objectFit: 'contain', padding: 4 }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="cp-divider" />
                    <button className="cp-primary-btn cp-wide-btn" type="submit">Create Match</button>
                  </form>
                </div>

                {/* Live Score Tab */}
                <div className={`cp-tab-content ${activeMatchTab === 'live' ? 'active' : ''}`}>
                  {/* Match Status Section */}
                  <div className="cp-section-header">
                    <span>Match Status</span>
                  </div>
                  <div className="cp-form-row">
                    <label>Status</label>
                    <select value={fMatchStatus} onChange={e => setFMatchStatus(e.target.value as any)}>
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="done">Done</option>
                    </select>
                  </div>

                  {/* Prediction Controls Section */}
                  <div className="cp-section-header">
                    <span>Prediction Controls</span>
                    <div style={{ 
                      fontSize: '11px', 
                      color: 'var(--muted)',
                      marginLeft: '8px',
                      padding: '2px 8px',
                      background: fPredictionsEnabled ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)',
                      borderRadius: '12px',
                      border: `1px solid ${fPredictionsEnabled ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`
                    }}>
                      {fPredictionsEnabled ? '🟢 Active' : '🔴 Disabled'}
                    </div>
                  </div>
                  <div className="cp-form-row">
                    <label className="cp-toggle-row" title="Enable or disable predictions for this match">
                      <span>Enable Predictions</span>
                      <Toggle checked={fPredictionsEnabled} onChange={handleTogglePredictions} />
                      <div style={{ 
                        fontSize: '10px', 
                        color: 'var(--muted)',
                        marginLeft: '8px'
                      }}>
                        {fPredictionsEnabled ? 'Click to disable' : 'Click to enable'}
                      </div>
                    </label>
                  </div>
                  <div className="cp-form-row">
                    <label className="cp-toggle-row" title="Temporarily pause predictions (requires predictions to be enabled)">
                      <span>Pause Predictions</span>
                      <Toggle checked={fPredictionsPaused} onChange={handlePausePredictionsWithReason} />
                      <div style={{ 
                        fontSize: '10px', 
                        color: 'var(--muted)',
                        marginLeft: '8px'
                      }}>
                        {fPredictionsPaused ? 'Click to resume' : 'Click to pause (optional reason)'}
                      </div>
                    </label>
                  </div>
                  {fPredictionsPaused && (
                    <div className="cp-form-row">
                      <label>Pause Reason</label>
                      <input
                        type="text"
                        value={fPauseReason}
                        onChange={e => setFPauseReason(e.target.value)}
                        placeholder="Reason for pausing predictions..."
                        style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text)' }}
                      />
                    </div>
                  )}

                  <div className="cp-form-row">
                    <label className="cp-toggle-row">
                      <span>Allow re-prediction</span>
                      <Toggle checked={fAllowReprediction} onChange={handleToggleReprediction} />
                      <div style={{ 
                        fontSize: '10px', 
                        color: 'var(--muted)',
                        marginLeft: '8px'
                      }}>
                        {fAllowReprediction ? 'Click to disable' : 'Click to enable'}
                      </div>
                    </label>
                  </div>
                  
                  <div className="cp-form-row">
                    <div style={{ 
                      padding: '8px 12px', 
                      background: 'rgba(99, 102, 241, 0.1)', 
                      borderRadius: '6px', 
                      border: '1px solid rgba(99, 102, 241, 0.2)', 
                      fontSize: '11px',
                      color: 'var(--muted)',
                      marginTop: '8px'
                    }}>
                      <strong>💡 Toggle Behavior:</strong> All toggles update Firebase immediately. No separate button click needed - changes take effect instantly with visual confirmation.
                    </div>
                  </div>

                  <div className="cp-divider" />
                  
                  {/* Sport-specific Match Controls */}
                  {fSport === 'cricket' && (
                    <CricketMatchDetails
                      fTeamA={fTeamA}
                      fTeamB={fTeamB}
                      fBattingTeam={fBattingTeam}
                      fInnings={fInnings}
                      setFBattingTeam={setFBattingTeam}
                      setFInnings={setFInnings}
                    />
                  )}
                  {fSport === 'football' && (
                    <FootballMatchDetails
                      fTeamA={fTeamA}
                      fTeamB={fTeamB}
                    />
                  )}

                  <div className="cp-divider" />
                  
                  {/* Live Score Controls */}
                  <div className="cp-section-header">
                    <span>Live Score Management</span>
                  </div>
                  <div className="cp-form-row">
                    <label>Score Source</label>
                    <select value={scoreSource} onChange={e => setScoreSource(e.target.value as any)}>
                      <option value="manual">Manual</option>
                      <option value="scraper">Scraper</option>
                      <option value="api">API</option>
                      <option value="prediction">Prediction Fallback</option>
                    </select>
                  </div>
                  
                  {/* Sport-specific Live Score */}
                  {fSport === 'cricket' && (
                    <CricketLiveScore
                      fTeamA={fTeamA}
                      fTeamB={fTeamB}
                      fTossWinner={fTossWinner}
                      fTossDecision={fTossDecision}
                      fBattingTeam={fBattingTeam}
                      fInnings={fInnings}
                      scoreTeamARuns={scoreTeamARuns}
                      scoreTeamAWickets={scoreTeamAWickets}
                      scoreTeamAOvers={scoreTeamAOvers}
                      scoreTeamBRuns={scoreTeamBRuns}
                      scoreTeamBWickets={scoreTeamBWickets}
                      scoreTeamBOvers={scoreTeamBOvers}
                      setFTossWinner={setFTossWinner}
                      setFTossDecision={setFTossDecision}
                      setFBattingTeam={setFBattingTeam}
                      setFInnings={setFInnings}
                      setScoreTeamARuns={setScoreTeamARuns}
                      setScoreTeamAWickets={setScoreTeamAWickets}
                      setScoreTeamAOvers={setScoreTeamAOvers}
                      setScoreTeamBRuns={setScoreTeamBRuns}
                      setScoreTeamBWickets={setScoreTeamBWickets}
                      setScoreTeamBOvers={setScoreTeamBOvers}
                      setIsEditingScore={setIsEditingScore}
                    />
                  )}
                  {fSport === 'football' && (
                    <FootballLiveScore
                      fTeamA={fTeamA}
                      fTeamB={fTeamB}
                      scoreTeamARuns={scoreTeamARuns}
                      scoreTeamBRuns={scoreTeamBRuns}
                      setScoreTeamARuns={setScoreTeamARuns}
                      setScoreTeamBRuns={setScoreTeamBRuns}
                    />
                  )}
                  <div className="cp-divider" />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="cp-action-btn" 
                      type="button" 
                      onClick={handleUpdateLiveScore}
                      style={{ flex: 1 }}
                    >
                      Update Live Score
                    </button>
                    <button 
                      className="cp-secondary-btn" 
                      type="button" 
                      onClick={handleRunScraper}
                      disabled={scraperRunning}
                      style={{ flex: 1 }}
                    >
                      {scraperRunning ? 'Running...' : 'Run Scraper'}
                    </button>
                  </div>
                  {scraperStatus && (
                    <p className="cp-panel-note" style={{ color: scraperStatus.includes('Success') ? '#34c759' : scraperStatus.includes('Failed') || scraperStatus.includes('Error') ? '#ef4444' : 'var(--muted)' }}>
                      {scraperStatus}
                    </p>
                  )}
                  <div className="cp-form-row">
                    <label>Scraper Order (comma-separated)</label>
                    <input 
                      type="text" 
                      value={scraperOrder} 
                      onChange={e => setScraperOrder(e.target.value)}
                      placeholder="cricbuzz,google,cricapi"
                      style={{ fontSize: '11px' }}
                    />
                  </div>
                  <div className="cp-form-row">
                    <label>Match URL (optional - for direct scraping)</label>
                    <input 
                      type="text" 
                      value={scraperMatchUrl} 
                      onChange={e => setScraperMatchUrl(e.target.value)}
                      placeholder="https://www.cricbuzz.com/live-cricket-scores/..."
                      style={{ fontSize: '11px' }}
                    />
                    <p className="cp-panel-note" style={{ marginTop: '4px', fontSize: '10px' }}>
                      Paste a direct match URL from Cricbuzz, ESPNcricinfo, etc. for more accurate scraping.
                    </p>
                  </div>
                  <p className="cp-panel-note">Updates will be reflected in real-time on the audience match page.</p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Window Management ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('windowEngine')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>Window Management</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.windowEngine ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card" style={{ display: collapsedSections.windowEngine ? 'none' : 'block' }}>
            <div className="cp-form-row">
              <label className="cp-toggle-row">
                <span>Overlay Window</span>
                <Toggle checked={windowVisibility.overlayVisible} onChange={(v) => handleWindowVisibilityChange('overlayVisible', v)} />
              </label>
            </div>
            <div className="cp-form-row">
              <label className="cp-toggle-row">
                <span>Ticker Window</span>
                <Toggle checked={windowVisibility.tickerVisible} onChange={(v) => handleWindowVisibilityChange('tickerVisible', v)} />
              </label>
            </div>
            <div className="cp-form-row">
              <label className="cp-toggle-row">
                <span>Reaction Window</span>
                <Toggle checked={windowVisibility.reactionVisible} onChange={(v) => handleWindowVisibilityChange('reactionVisible', v)} />
              </label>
            </div>
            <p className="cp-panel-note">Toggle overlay windows on/off. Only one instance of each window type is allowed.</p>
          </div>
        </section>

        {/* ── Match Resolution ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('resolution')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>Match Resolution</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.resolution ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card cp-stack" style={{ display: collapsedSections.resolution ? 'none' : 'block' }}>
            {!is2nd ? (
              <div className="cp-form-row">
                <label>Actual 1st Innings Score</label>
                <input type="number" id="actualScore" value={fActualScore} onChange={e => setFActualScore(e.target.value)} placeholder="e.g. 158" min="1" max="999" />
              </div>
            ) : (
              <>
                <div className="cp-form-row">
                  <label>Did {chasingTeam} win?</label>
                  <div className="cp-radio-group">
                    <div className="cp-radio-option">
                      <input type="radio" id="chaserYes" name="chaserWon" value="yes" checked={fChaserWon === 'yes'} onChange={() => setFChaserWon('yes')} />
                      <label className="cp-radio-label" htmlFor="chaserYes">Yes</label>
                    </div>
                    <div className="cp-radio-option">
                      <input type="radio" id="chaserNo" name="chaserWon" value="no" checked={fChaserWon === 'no'} onChange={() => setFChaserWon('no')} />
                      <label className="cp-radio-label" htmlFor="chaserNo">No</label>
                    </div>
                  </div>
                </div>
                <div className="cp-form-row">
                  <label>{fChaserWon === 'yes' ? 'Actual Overs (e.g. 15.2)' : 'Actual Chasing Score'}</label>
                  <input type="number" id="actualResult" value={fActualResult} onChange={e => setFActualResult(e.target.value)} placeholder={fChaserWon === 'yes' ? 'e.g. 15.2' : 'e.g. 145'} step="any" min="0" />
                </div>
              </>
            )}
            <div className="cp-input-action-group">
              <button id="calculatePoints" className="cp-primary-btn" onClick={resolveMatch}>
                {is2nd ? 'Resolve 2nd Innings' : 'Resolve 1st Innings'}
              </button>
              <button id="viewFinalStandings" className="cp-action-btn" onClick={viewFinalStandings}>View Final Game Standings</button>
            </div>
            <div className="cp-form-row" style={{ marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={forceReprocess} 
                  onChange={(e) => setForceReprocess(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: '#999' }}>Force reprocess (skip reconciled check)</span>
              </label>
            </div>
            {resolutionMessage && (
              <div 
                className="cp-panel-note" 
                style={{ 
                  marginTop: '12px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: resolutionStatus === 'success' ? 'rgba(52, 199, 89, 0.1)' : 
                             resolutionStatus === 'error' ? 'rgba(255, 59, 48, 0.1)' : 
                             'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${resolutionStatus === 'success' ? 'rgba(52, 199, 89, 0.3)' : 
                                    resolutionStatus === 'error' ? 'rgba(255, 59, 48, 0.3)' : 
                                    'rgba(255, 255, 255, 0.1)'}`,
                  color: resolutionStatus === 'success' ? '#34c759' : 
                         resolutionStatus === 'error' ? '#ff3b30' : 
                         'var(--text-primary)'
                }}
              >
                {resolutionStatus === 'running' && '⏳ '}
                {resolutionStatus === 'success' && '✅ '}
                {resolutionStatus === 'error' && '❌ '}
                {resolutionMessage}
              </div>
            )}
            <p className="cp-panel-note">Resolve the current innings to archive points and prepare for the final report. Python processing handles scoring and leaderboard updates automatically.</p>
          </div>
        </section>

        {/* ── Live Win Probability ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('winProb')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>Live Win Probability (Google)</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.winProb ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card cp-stack" style={{ display: collapsedSections.winProb ? 'none' : 'block' }}>
            <div className="cp-form-row">
              <label>Google Match URL</label>
              <div className="cp-input-action-group">
                <input id="googleMatchUrl" type="text" value={googleUrl} onChange={e => setGoogleUrl(e.target.value)} onBlur={handleGoogleUrlSave} placeholder="Paste Google URL here..." />
                <button id="fetchNowBtn" className="cp-action-btn" type="button" onClick={performWinProbFetch}>Fetch Now</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span id="fetchStatus" className="cp-panel-note" style={{ marginTop: 0 }}>{fetchStatus}</span>
                <button className="cp-glass-btn cp-small" title="View screenshot of what the scraper sees" style={{ padding: '4px 8px', fontSize: 10 }}
                  // @ts-ignore
                  onClick={() => window.overlayDesktop.viewScraperDebug()}>View Debug</button>
                <button className="cp-action-btn cp-small" title="Solve Google CAPTCHA" style={{ padding: '4px 8px', fontSize: 10 }}
                  onClick={() => {
                    if (!googleUrl.trim()) { alert('Please paste the Google Match URL first.'); return; }
                    // @ts-ignore
                    window.overlayDesktop.openScraperSolver(googleUrl);
                  }}>Solve CAPTCHA</button>
              </div>
            </div>
            <div className="cp-form-row">
              <label className="cp-toggle-row">
                <span>Auto-Fetch (30s)</span>
                <Toggle checked={autoFetch} onChange={setAutoFetch} />
              </label>
            </div>
            <div className="cp-form-row">
              <label className="cp-toggle-row">
                <span>Show on Overlay</span>
                <Toggle checked={showWinProb} onChange={handleShowWinProbToggle} />
              </label>
            </div>
            <div className="cp-divider" />
            <p className="cp-panel-note">Slider updates automatically if Auto-Fetch is on. You can also fetch manually.</p>
          </div>
        </section>

        {/* ── Automation Scheduler ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('scheduler')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>Enhanced Automation</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.scheduler ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card" style={{ display: collapsedSections.scheduler ? 'none' : 'block' }}>
            {/* Enhanced Automation Status */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 600 }}>
                  Enhanced Automation Status
                </span>
                <span className={`cp-dot ${schedulerRunning ? 'active' : 'inactive'}`} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {schedulerRunning ? 'Running' : 'Offline'}
              </span>
              {wsConnection && (
                <span style={{ fontSize: '10px', color: '#34c759', marginLeft: '8px' }}>
                  ● Connected
                </span>
              )}
            </div>

            {/* Automation Tasks */}
            {automationStatus && (
              <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <div className="cp-section-header">
                  <span>Active Tasks ({automationStatus.total_tasks || 0})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Running:</span>
                    <span style={{ color: '#34c759' }}>{automationStatus.running_tasks || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Errors:</span>
                    <span style={{ color: '#ff3b30' }}>{automationStatus.error_tasks || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Uptime:</span>
                    <span>{Math.floor((automationStatus.uptime || 0) / 60000)}m</span>
                  </div>
                </div>
              </div>
            )}

            {/* Control Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button 
                className="cp-action-btn cp-small"
                onClick={async () => {
                  try {
                    // @ts-ignore
                    const result = await window.overlayDesktop.triggerAutomationTask('live_scraping');
                    if (result.success) {
                      console.log('Live scraping triggered');
                    } else {
                      console.error('Failed to trigger live scraping:', result.error);
                    }
                  } catch (error) {
                    console.error('Error triggering live scraping:', error);
                  }
                }}
              >
                Trigger Scraping
              </button>
              <button 
                className="cp-action-btn cp-small"
                onClick={async () => {
                  try {
                    // @ts-ignore
                    const result = await window.overlayDesktop.triggerAutomationTask('score_processing');
                    if (result.success) {
                      console.log('Score processing triggered');
                    } else {
                      console.error('Failed to trigger score processing:', result.error);
                    }
                  } catch (error) {
                    console.error('Error triggering score processing:', error);
                  }
                }}
              >
                Process Scores
              </button>
              <button 
                className="cp-action-btn cp-small"
                onClick={async () => {
                  try {
                    // @ts-ignore
                    const result = await window.overlayDesktop.triggerAutomationTask('match_creation');
                    if (result.success) {
                      console.log('Match creation triggered');
                    } else {
                      console.error('Failed to trigger match creation:', result.error);
                    }
                  } catch (error) {
                    console.error('Error triggering match creation:', error);
                  }
                }}
              >
                Create Matches
              </button>
            </div>

            {/* Legacy Scheduler Status */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  Legacy Scheduler
                </span>
                <span className={`cp-dot ${schedulerRunning ? 'active' : 'inactive'}`} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {schedulerRunning ? 'Running' : 'Stopped'}
              </span>
            </div>

            {/* Task List */}
            <div className="cp-section-header">
              <span>Scheduled Tasks</span>
            </div>
            {Object.keys(schedulerTasks).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
                  No tasks configured
                </p>
                <button 
                  className="cp-action-btn cp-small"
                  onClick={initializeSchedulerTasks}
                >
                  Initialize Default Tasks
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(schedulerTasks).map(([taskId, task]: [string, any]) => (
                  <div key={taskId} style={{ 
                    padding: '12px', 
                    background: 'rgba(255,255,255,0.03)', 
                    borderRadius: '8px',
                    border: '1px solid var(--panel-border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{task.name}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className={`cp-dot ${task.enabled ? 'active' : 'inactive'}`} />
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {task.last_status || 'idle'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
                      <span>Interval: {task.interval_seconds}s</span>
                      {task.last_run && <span>Last run: {new Date(task.last_run).toLocaleTimeString()}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Interval (s):
                        <input 
                          type="number" 
                          value={task.interval_seconds}
                          onChange={(e) => handleUpdateSchedulerTask(taskId, { interval_seconds: parseInt(e.target.value) })}
                          style={{ width: '60px', padding: '4px', fontSize: '11px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '4px', color: 'var(--text)' }}
                          min="10"
                        />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="cp-action-btn cp-small"
                        onClick={() => handleTriggerSchedulerTask(taskId)}
                        disabled={task.last_status === 'running'}
                      >
                        Run Now
                      </button>
                      <button 
                        className="cp-action-btn cp-small"
                        onClick={() => handleToggleSchedulerTask(taskId)}
                      >
                        {task.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button 
                        className="cp-action-btn cp-small cp-danger"
                        onClick={() => {
                          if (confirm(`Delete task "${task.name}"?`)) {
                            // @ts-ignore
                            update(ref(db, getDbRoot() + '/scheduler_config/tasks/' + taskId), null);
                            loadSchedulerTasks();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button 
                className="cp-secondary-btn"
                onClick={loadSchedulerTasks}
                style={{ flex: 1 }}
              >
                Refresh Tasks
              </button>
              <button 
                className="cp-secondary-btn"
                onClick={checkSchedulerStatus}
                style={{ flex: 1 }}
              >
                Check Status
              </button>
            </div>
          </div>
        </section>

        {/* ── Discord Notifications ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('discordNotifications')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>Discord Notifications</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.discordNotifications ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card" style={{ display: collapsedSections.discordNotifications ? 'none' : 'block' }}>
            {/* Discord Status */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 600 }}>
                  Discord Integration
                </span>
                <span className={`cp-dot ${wsConnection ? 'active' : 'inactive'}`} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {wsConnection ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Discord Configuration */}
            <div className="cp-section-header">
              <span>Webhook Configuration</span>
            </div>
            
            <div className="cp-form-row">
              <label>Webhook URL</label>
              <input 
                type="url" 
                placeholder="https://discord.com/api/webhooks/..."
                style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid var(--panel-border)', 
                  borderRadius: '6px', 
                  color: 'var(--text)',
                  padding: '8px 12px',
                  fontSize: '13px',
                  width: '100%'
                }}
                onChange={(e) => {
                  // TODO: Save to Firebase
                  console.log('Discord webhook URL:', e.target.value);
                }}
              />
            </div>

            <div className="cp-dual-row">
              <div className="cp-form-row">
                <label>Bot Username</label>
                <input 
                  type="text" 
                  placeholder="Automation Bot"
                  maxLength={32}
                  style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid var(--panel-border)', 
                    borderRadius: '6px', 
                    color: 'var(--text)',
                    padding: '8px 12px',
                    fontSize: '13px'
                  }}
                  onChange={(e) => {
                    // TODO: Save to Firebase
                    console.log('Bot username:', e.target.value);
                  }}
                />
              </div>
              <div className="cp-form-row">
                <label>Avatar URL (Optional)</label>
                <input 
                  type="url" 
                  placeholder="https://example.com/avatar.png"
                  style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid var(--panel-border)', 
                    borderRadius: '6px', 
                    color: 'var(--text)',
                    padding: '8px 12px',
                    fontSize: '13px'
                  }}
                  onChange={(e) => {
                    // TODO: Save to Firebase
                    console.log('Avatar URL:', e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="cp-form-row">
              <label className="cp-toggle-row">
                <span>Enable Rich Embeds</span>
                <Toggle checked={true} onChange={(v) => {
                  // TODO: Save to Firebase
                  console.log('Rich embeds:', v);
                }} />
              </label>
            </div>

            <div className="cp-form-row">
              <label className="cp-toggle-row">
                <span>Enable Notifications</span>
                <Toggle checked={true} onChange={(v) => {
                  // TODO: Save to Firebase
                  console.log('Enable notifications:', v);
                }} />
              </label>
            </div>

            <div className="cp-divider" />

            {/* Notification Types */}
            <div className="cp-section-header">
              <span>Notification Types</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Match Created</span>
                <Toggle checked={true} onChange={(v) => console.log('Match created:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Match Started</span>
                <Toggle checked={true} onChange={(v) => console.log('Match started:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Match Completed</span>
                <Toggle checked={true} onChange={(v) => console.log('Match completed:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Score Updates</span>
                <Toggle checked={false} onChange={(v) => console.log('Score updates:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Automation Errors</span>
                <Toggle checked={true} onChange={(v) => console.log('Automation errors:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>System Alerts</span>
                <Toggle checked={true} onChange={(v) => console.log('System alerts:', v)} />
              </label>
            </div>

            {/* Rate Limiting */}
            <div className="cp-form-row">
              <label>Rate Limit (messages per minute)</label>
              <input 
                type="number" 
                min="1" 
                max="60" 
                defaultValue="10"
                style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid var(--panel-border)', 
                  borderRadius: '6px', 
                  color: 'var(--text)',
                  padding: '8px 12px',
                  fontSize: '13px',
                  width: '120px'
                }}
                onChange={(e) => {
                  // TODO: Save to Firebase
                  console.log('Rate limit:', e.target.value);
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button 
                className="cp-action-btn cp-small"
                onClick={async () => {
                  try {
                    // @ts-ignore
                    const result = await window.overlayDesktop.testDiscordNotification();
                    if (result.success) {
                      alert('Test notification sent successfully!');
                    } else {
                      alert(`Test failed: ${result.error}`);
                    }
                  } catch (error) {
                    console.error('Error testing Discord:', error);
                    alert('Failed to test Discord notification');
                  }
                }}
              >
                Test Notification
              </button>
              <button 
                className="cp-primary-btn cp-small"
                onClick={() => {
                  // TODO: Save configuration to Firebase
                  alert('Configuration saved!');
                }}
              >
                Save Configuration
              </button>
            </div>

            <div className="cp-divider" />

            {/* Setup Guide Link */}
            <div style={{ 
              padding: '12px', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#818cf8' }}>
                📖 Setup Guide
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px 0' }}>
                Need help setting up Discord notifications? Follow our comprehensive setup guide.
              </p>
              <button 
                className="cp-action-btn cp-small"
                onClick={() => setSetupGuideViewer({ open: true, type: 'discord' })}
              >
                View Setup Guide
              </button>
            </div>

            <p className="cp-panel-note" style={{ marginTop: '12px' }}>
              Discord notifications provide real-time updates about match events, automation status, and system alerts directly to your Discord server.
            </p>
          </div>
        </section>

        {/* ── Push Notifications ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('pushNotifications')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>Push Notifications</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.pushNotifications ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card" style={{ display: collapsedSections.pushNotifications ? 'none' : 'block' }}>
            {/* Push Notification Status */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>
                  Push Notification System
                </span>
                <span className={`cp-dot ${wsConnection ? 'active' : 'inactive'}`} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {wsConnection ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* User Statistics */}
            <div className="cp-section-header">
              <span>User Statistics</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#10b981' }}>0</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total Users</div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#3b82f6' }}>0</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Active Devices</div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#f59e0b' }}>0</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Sent Today</div>
              </div>
            </div>

            {/* Push Notification Configuration */}
            <div className="cp-section-header">
              <span>Push Notification Configuration</span>
            </div>
            
            <div className="cp-form-row">
              <label className="cp-toggle-row">
                <span>Enable Push Notifications</span>
                <Toggle checked={true} onChange={(v) => {
                  // TODO: Save to Firebase
                  console.log('Enable push notifications:', v);
                }} />
              </label>
            </div>

            <div className="cp-form-row">
              <label>Firebase Project ID</label>
              <input 
                type="text" 
                placeholder="your-project-id"
                style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid var(--panel-border)', 
                  borderRadius: '6px', 
                  color: 'var(--text)',
                  padding: '8px 12px',
                  fontSize: '13px',
                  width: '100%'
                }}
                onChange={(e) => {
                  // TODO: Save to Firebase
                  console.log('Firebase project ID:', e.target.value);
                }}
              />
            </div>

            <div className="cp-form-row">
              <label>Service Account Key (JSON)</label>
              <textarea 
                placeholder="Paste Firebase service account key JSON..."
                rows={4}
                style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid var(--panel-border)', 
                  borderRadius: '6px', 
                  color: 'var(--text)',
                  padding: '8px 12px',
                  fontSize: '12px',
                  width: '100%',
                  fontFamily: 'monospace'
                }}
                onChange={(e) => {
                  // TODO: Save to Firebase
                  console.log('Service account key updated');
                }}
              />
            </div>

            <div className="cp-form-row">
              <label>VAPID Public Key</label>
              <input 
                type="text" 
                placeholder="Generated automatically"
                readOnly
                style={{ 
                  background: 'rgba(0,0,0,0.1)', 
                  border: '1px solid var(--panel-border)', 
                  borderRadius: '6px', 
                  color: 'var(--muted)',
                  padding: '8px 12px',
                  fontSize: '12px',
                  width: '100%',
                  fontFamily: 'monospace'
                }}
                value="Generated when Web Push is configured"
              />
            </div>

            <div className="cp-divider" />

            {/* Notification Types */}
            <div className="cp-section-header">
              <span>Default Notification Types</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Match Created</span>
                <Toggle checked={true} onChange={(v) => console.log('Push match created:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Match Started</span>
                <Toggle checked={true} onChange={(v) => console.log('Push match started:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Match Completed</span>
                <Toggle checked={true} onChange={(v) => console.log('Push match completed:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Score Updates</span>
                <Toggle checked={false} onChange={(v) => console.log('Push score updates:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>Automation Errors</span>
                <Toggle checked={true} onChange={(v) => console.log('Push automation errors:', v)} />
              </label>
              <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
                <span>System Alerts</span>
                <Toggle checked={true} onChange={(v) => console.log('Push system alerts:', v)} />
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button 
                className="cp-action-btn cp-small"
                onClick={async () => {
                  try {
                    // @ts-ignore
                    const result = await window.overlayDesktop.testPushNotification();
                    if (result.success) {
                      alert('Test push notification sent successfully!');
                    } else {
                      alert(`Test failed: ${result.error}`);
                    }
                  } catch (error) {
                    console.error('Error testing push notification:', error);
                    alert('Failed to test push notification');
                  }
                }}
              >
                Test Push Notification
              </button>
              <button 
                className="cp-primary-btn cp-small"
                onClick={() => {
                  // TODO: Save configuration to Firebase
                  alert('Push notification configuration saved!');
                }}
              >
                Save Configuration
              </button>
            </div>

            <div className="cp-divider" />

            {/* User Management */}
            <div className="cp-section-header">
              <span>User Management</span>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="Search users by ID or email..."
                style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid var(--panel-border)', 
                  borderRadius: '6px', 
                  color: 'var(--text)',
                  padding: '8px 12px',
                  fontSize: '13px',
                  width: '100%',
                  marginBottom: '8px'
                }}
                onChange={(e) => {
                  // TODO: Implement user search
                  console.log('Search users:', e.target.value);
                }}
              />
              <button 
                className="cp-action-btn cp-small"
                onClick={() => {
                  // TODO: Load user list
                  alert('User management feature coming soon!');
                }}
              >
                Manage Users
              </button>
            </div>

            {/* Setup Guide Link */}
            <div style={{ 
              padding: '12px', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#10b981' }}>
                📱 Push Notification Setup
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px 0' }}>
                Configure Firebase Cloud Messaging and Web Push API to deliver notifications directly to users' devices.
              </p>
              <button 
                className="cp-action-btn cp-small"
                onClick={() => setSetupGuideViewer({ open: true, type: 'push' })}
              >
                View Setup Guide
              </button>
            </div>

            <p className="cp-panel-note" style={{ marginTop: '12px' }}>
              Push notifications deliver messages directly to individual users' devices based on their preferences. Unlike Discord, users can control exactly what they receive.
            </p>
          </div>
        </section>

        {/* ── User Management ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('userManagement')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>User Management</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.userManagement ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card" style={{ display: collapsedSections.userManagement ? 'none' : 'block' }}>
            {/* User Search */}
            <div className="cp-section-header">
              <span>Search User</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={userSearchUsername}
                onChange={(e) => setUserSearchUsername(e.target.value)}
                placeholder="Enter username..."
                style={{ 
                  flex: 1, 
                  padding: '8px 12px', 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid var(--panel-border)', 
                  borderRadius: '6px', 
                  color: 'var(--text)',
                  fontSize: '13px'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
              />
              <button 
                className="cp-action-btn"
                onClick={handleSearchUser}
                disabled={userSearchLoading}
              >
                {userSearchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {userSearchError && (
              <div style={{ 
                padding: '8px 12px', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderRadius: '6px', 
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '12px',
                marginBottom: '12px'
              }}>
                {userSearchError}
              </div>
            )}

            {/* User Result */}
            {userSearchResult && (
              <div style={{ 
                padding: '16px', 
                background: 'rgba(99, 102, 241, 0.1)', 
                borderRadius: '8px', 
                border: '1px solid rgba(99, 102, 241, 0.3)',
                marginBottom: '16px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#818cf8' }}>
                    {userSearchUsername}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Client ID:</span>
                      <span style={{ marginLeft: '8px', fontFamily: 'monospace', color: 'var(--text)' }}>
                        {userSearchResult.clientId}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Role:</span>
                      <span style={{ marginLeft: '8px', color: 'var(--text)' }}>
                        {userSearchResult.role || 'user'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Status:</span>
                      <span style={{ marginLeft: '8px', color: userSearchResult.enabled ? '#34c759' : '#ef4444' }}>
                        {userSearchResult.enabled ? 'Enabled' : 'Blocked'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Failed Attempts:</span>
                      <span style={{ marginLeft: '8px', color: 'var(--text)' }}>
                        {userSearchResult.failedLoginAttempts || 0}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Passkey:</span>
                      <span style={{ marginLeft: '8px', fontFamily: 'monospace', color: 'var(--accent-blue)' }}>
                        {userSearchResult.passkey}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Created:</span>
                      <span style={{ marginLeft: '8px', color: 'var(--text)' }}>
                        {userSearchResult.createdAt ? new Date(userSearchResult.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="cp-action-btn cp-small"
                      onClick={handleResetPasskey}
                      style={{ flex: 1, background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}
                    >
                      Reset Passkey
                    </button>
                    <button 
                      className={`cp-action-btn cp-small ${userSearchResult.enabled ? 'cp-danger' : ''}`}
                      onClick={() => handleBlockUser(userSearchResult.enabled)}
                      style={{ flex: 1, background: userSearchResult.enabled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(52, 199, 89, 0.2)', color: userSearchResult.enabled ? '#ef4444' : '#34c759' }}
                    >
                      {userSearchResult.enabled ? 'Block User' : 'Unblock User'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Set Role:</span>
                    <select
                      value={userSearchResult.role || 'user'}
                      onChange={(e) => handleSetUserRole(e.target.value as any)}
                      style={{ 
                        flex: 1, 
                        padding: '6px 8px', 
                        background: 'rgba(0,0,0,0.2)', 
                        border: '1px solid var(--panel-border)', 
                        borderRadius: '4px', 
                        color: 'var(--text)',
                        fontSize: '12px'
                      }}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Window & Engine ── */}
        <section className="cp-panel-group">
          <div 
            className="cp-group-header" 
            onClick={() => toggleSection('windowEngine')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 className="cp-group-title" style={{ margin: 0 }}>Window &amp; Engine</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.windowEngine ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card cp-stack" style={{ display: collapsedSections.windowEngine ? 'none' : 'block' }}>
            <div className="cp-control-row">
              <label>Master Opacity</label>
              <div className="cp-slider-group">
                <input id="opacity" type="range" min="0.2" max="1" step="0.05" value={opacity}
                  onChange={async e => {
                    const v = parseFloat(e.target.value);
                    setOpacity(v);
                    await updateS({ opacity: v });
                  }} />
                <span className="cp-value-tag">{Math.round(opacity * 100)}%</span>
              </div>
            </div>
            <div className="cp-action-grid">
              {/* @ts-ignore */}
              <button id="showOverlay" className="cp-glass-btn" onClick={() => window.overlayDesktop.showOverlay()}>Show</button>
              {/* @ts-ignore */}
              <button id="hideOverlay" className="cp-glass-btn" onClick={() => window.overlayDesktop.hideOverlay()}>Hide</button>
              {/* @ts-ignore */}
              <button id="reloadOverlay" className="cp-glass-btn" onClick={() => window.overlayDesktop.reloadOverlay()}>Reload</button>
              {/* @ts-ignore */}
              <button id="resetBounds" className="cp-glass-btn" onClick={() => window.overlayDesktop.resetBounds()}>Reset</button>
            </div>
            <div className="cp-control-row">
              <label>Ticker Overlay</label>
              <div className="cp-action-grid">
                {/* @ts-ignore */}
                <button id="showTicker" className="cp-glass-btn" onClick={() => window.overlayDesktop.showTicker()}>Show Ticker</button>
                {/* @ts-ignore */}
                <button id="hideTicker" className="cp-glass-btn" onClick={() => window.overlayDesktop.hideTicker()}>Hide Ticker</button>
                {/* @ts-ignore */}
                <button id="reloadTicker" className="cp-glass-btn" onClick={() => window.overlayDesktop.reloadTicker()}>Reload</button>
                {/* @ts-ignore */}
                <button id="resetTickerBounds" className="cp-glass-btn" onClick={() => window.overlayDesktop.resetTickerBounds()}>Reset Ticker</button>
              </div>
            </div>
            <button id="togglePredictionPause" className="cp-secondary-btn cp-wide-btn" onClick={togglePredictionPause}>
              {predPaused ? 'Resume Predictions' : 'Pause Predictions'}
            </button>
            <button id="toggleSortMode" className="cp-secondary-btn cp-wide-btn" onClick={toggleSortMode}>
              {sortMode === 'newest' ? 'Sort by Score' : 'Sort by Newest'}
            </button>
            <button id="toggleHideChat" className="cp-secondary-btn cp-wide-btn" onClick={toggleHideChat}>
              {chatHidden ? 'Show Live Chat' : 'Hide Live Chat'}
            </button>
            <button id="toggleHideJoin" className="cp-secondary-btn cp-wide-btn" onClick={toggleHideJoin}>
              {joinHidden ? 'Show Join Section' : 'Hide Join Section'}
            </button>
            <div className="cp-divider" />
            <div className="cp-action-grid" style={{ marginTop: 12 }}>
              <button id="clearPredictions" className="cp-glass-btn cp-danger" onClick={() => handleClear('predictions')}>Clear Predictions</button>
              <button id="clearChat" className="cp-glass-btn cp-danger" onClick={() => handleClear('chat')}>Clear Chat</button>
            </div>
          </div>

          <h2 className="cp-group-title" style={{ marginTop: 20 }}>GIF Reactions</h2>
          <div className="cp-glass-card cp-stack">
            <div className="cp-control-row">
              <label>Reaction Opacity</label>
              <div className="cp-slider-group">
                <input id="reactionOpacity" type="range" min="0" max="1" step="0.05" value={reactionOpacity}
                  onChange={async e => {
                    const v = parseFloat(e.target.value);
                    setReactionOpacity(v);
                    await updateS({ reactionOpacity: v });
                  }} />
                <span className="cp-value-tag">{Math.round(reactionOpacity * 100)}%</span>
              </div>
            </div>
            <p className="cp-section-hint">Control the reaction window for Klipy GIFs.</p>
            <div className="cp-action-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              {/* @ts-ignore */}
              <button id="showReaction" className="cp-glass-btn" onClick={() => window.overlayDesktop.showReaction()}>Show Window</button>
              {/* @ts-ignore */}
              <button id="hideReaction" className="cp-glass-btn" onClick={() => window.overlayDesktop.hideReaction()}>Hide Window</button>
              {/* @ts-ignore */}
              <button id="reloadReaction" className="cp-glass-btn" onClick={() => window.overlayDesktop.reloadReaction()}>Reload</button>
              {/* @ts-ignore */}
              <button id="resetReactionBounds" className="cp-glass-btn" onClick={() => window.overlayDesktop.resetReactionBounds()}>Reset Pos</button>
              <button id="clearReactions" className="cp-glass-btn cp-danger" onClick={() => handleClear('reaction')}>Clear Reactions</button>
            </div>
          </div>

          {/* ── Status Panel ── */}
          <div className="cp-status-panel">
            <div className="cp-status-item">
              <span className={`cp-dot ${settings?.overlayVisible ? 'active' : 'inactive'}`} />
              <span className="cp-status-label">Visibility</span>
              <span className="cp-status-value">{settings?.overlayVisible ? 'Visible' : 'Hidden'}</span>
            </div>
            <div className="cp-status-item">
              <span className={`cp-dot ${settings?.clickThrough ? 'warning' : 'active'}`} />
              <span className="cp-status-label">Interaction</span>
              <span className="cp-status-value">{settings?.clickThrough ? 'Click-thru' : 'Interactive'}</span>
            </div>
            <div className="cp-status-item">
              <span className={`cp-dot ${predPaused ? 'inactive' : 'active'}`} />
              <span className="cp-status-label">Predictions</span>
              <span className="cp-status-value">{predPaused ? 'Paused' : 'Live'}</span>
            </div>
            <div className="cp-status-item">
              <span className={`cp-dot ${sortMode === 'score' ? 'active' : 'warning'}`} />
              <span className="cp-status-label">Sort Priority</span>
              <span className="cp-status-value">{sortMode === 'score' ? 'Score (Asc)' : 'Newest First'}</span>
            </div>
            <div className="cp-status-item">
              <span className={`cp-dot ${schedulerRunning ? 'active' : 'inactive'}`} />
              <span className="cp-status-label">Automation</span>
              <span className="cp-status-value">{schedulerRunning ? 'Running' : 'Offline'}</span>
            </div>
          </div>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          RESULTS DASHBOARD
      ══════════════════════════════════════════════════════════════════════ */}
      {resultsOpen && (
        <div className="cp-overlay">
          <div className="cp-results-content cp-glass-card">
            <header className="cp-results-header">
              <div>
                <span className="cp-badge">Ranking Results</span>
                <h2 id="resultsTitle">{resolveTitle}</h2>
              </div>
              <button className="cp-close-btn" onClick={() => setResultsOpen(false)}>&times;</button>
            </header>
            <div className="cp-results-stats">
              <div className="cp-stat-pill">Actual Score: <strong>{resActualScore}</strong></div>
            </div>
            <div className="cp-results-table-container">
              <table className="cp-results-table">
                <thead><tr><th>Rank</th><th>Name</th><th>Guess</th><th>Diff</th><th>Points</th></tr></thead>
                <tbody>
                  {lastResults.map((r, i) => (
                    <tr key={r.clientId}>
                      <td><RankPill rank={i + 1} /></td>
                      <td style={{ fontWeight: 700 }}>{r.name}</td>
                      <td>{r.guess}</td>
                      <td>{r.diff}</td>
                      <td style={{ fontWeight: 800, fontSize: 16 }}>{r.points}{r.isExact && <span className="cp-exact-tag">EXACT!</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="cp-results-footer">
              <div className="cp-footer-actions">
                <button className="cp-secondary-btn" onClick={downloadCSV}>Export to CSV</button>
                {!is2nd && (
                  <button className="cp-primary-btn" onClick={handlePrepNext}>
                    Clear All & Prep 2nd Innings
                  </button>
                )}
              </div>
              {!is2nd && <p className="cp-footer-note">Prep handles archiving this innings and switching teams.</p>}
            </footer>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          OVERALL STANDINGS
      ══════════════════════════════════════════════════════════════════════ */}
      {overallOpen && (
        <div className="cp-overlay">
          <div className="cp-results-content cp-glass-card">
            <header className="cp-results-header">
              <div>
                <span className="cp-badge">Match Conclusion</span>
                <h2>Final Match Report</h2>
              </div>
              <button className="cp-close-btn" onClick={() => setOverallOpen(false)}>&times;</button>
            </header>
            <div className="cp-results-table-container">
              <table className="cp-results-table">
                <thead><tr><th>Rank</th><th>Name</th><th>1st Innings</th><th>2nd Innings</th><th>Penalty</th><th>Total</th></tr></thead>
                <tbody>
                  {lastOverall.map((r, i) => (
                    <tr key={r.name}>
                      <td><RankPill rank={i + 1} /></td>
                      <td style={{ fontWeight: 700 }}>{r.name}</td>
                      <td>{r.p1Score} pts</td>
                      <td>{r.p2Score} pts</td>
                      <td>{r.penalty < 0 ? <span className="cp-penalty-minus">{r.penalty}</span> : '0'}</td>
                      <td style={{ fontWeight: 800, fontSize: 18 }}>{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="cp-results-footer">
              <div className="cp-footer-actions">
                <button className="cp-secondary-btn" onClick={downloadOverallCSV}>Export Full Match CSV</button>
                <button className="cp-danger-btn" onClick={handleEndMatch}>End Match &amp; Archive Data</button>
              </div>
              <p className="cp-footer-note">Ending the match will archive standings to history and clear the live room.</p>
            </footer>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HISTORY DASHBOARD
      ══════════════════════════════════════════════════════════════════════ */}
      {historyOpen && (
        <div className="cp-overlay">
          <div className="cp-history-content cp-glass-card">
            <header className="cp-results-header">
              <div>
                <span className="cp-badge">Match Archive</span>
                <h2>Daily Breakdowns</h2>
              </div>
              <div className="cp-header-actions">
                <button className="cp-primary-btn cp-small" onClick={() => { setManRows([{ name: '', p1Guess: '', win1: 'a', p2Guess: '', win2: 'a' }]); setManualOpen(true); }}>Add Manual Entry</button>
                <button className="cp-close-btn" onClick={() => setHistoryOpen(false)}>&times;</button>
              </div>
            </header>
            <div className="cp-history-layout">
              <aside className="cp-history-sidebar">
                <div className="cp-sidebar-label">Overviews</div>
                <div className="cp-match-list" style={{ marginBottom: 20 }}>
                  <div className={`cp-match-item season-stats-item${activeHistoryKey === 'season' ? ' active' : ''}`}
                    onClick={() => showSeasonStats()}>
                    <label>Archive Total</label>
                    <span>🏆 Season Standings</span>
                  </div>
                </div>
                <div className="cp-sidebar-label">Daily Matches</div>
                <div className="cp-match-list" id="matchList">
                  {sortHistoryLatestFirst(fullHistory).map(([key, match]) => (
                    <div key={key} className={`cp-match-item${activeHistoryKey === key ? ' active' : ''}`}
                      onClick={() => selectMatch(key)} style={{ position: 'relative' }}>
                      <div>
                        <label>{key.split('_')[0]}</label>
                        <span>{match.matchTitle}</span>
                      </div>
                      <button className="cp-edit-item-btn" title="Edit Match Results"
                        onClick={e => { e.stopPropagation(); openEditMatch(key); }}>✎</button>
                    </div>
                  ))}
                </div>
              </aside>
              <main className="cp-history-detail" id="matchDetail">
                {historyDetail || <div className="cp-empty-state"><p>Select a match from the sidebar.</p></div>}
              </main>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SCHEDULE EDITOR
      ══════════════════════════════════════════════════════════════════════ */}
      {showScheduleEditor && (
        <div className="cp-overlay">
          <div className="cp-manual-entry-content cp-glass-card">
            <header className="cp-results-header">
              <div>
                <span className="cp-badge">Schedule Editor</span>
                <h2>Edit Tournament Schedule</h2>
              </div>
              <button className="cp-close-btn" onClick={() => setShowScheduleEditor(false)}>&times;</button>
            </header>
            <div className="cp-manual-layout">
              <div className="cp-manual-section">
                <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--muted)' }}>Add New Match</h3>
                <div className="cp-dual-row">
                  <div className="cp-form-row">
                    <label>Team A</label>
                    <input 
                      value={editingSchedule.length > 0 ? editingSchedule[editingSchedule.length - 1]?.teamA || '' : ''} 
                      onChange={e => {
                        const newSchedule = [...editingSchedule];
                        if (newSchedule.length === 0) {
                          newSchedule.push({ teamA: e.target.value, teamB: '', date: '', venue: '', matchTitle: '', matchId: '', status: 'scheduled' });
                        } else {
                          newSchedule[newSchedule.length - 1].teamA = e.target.value;
                        }
                        setEditingSchedule(newSchedule);
                      }}
                      placeholder="e.g. CSK"
                    />
                  </div>
                  <div className="cp-form-row">
                    <label>Team B</label>
                    <input 
                      value={editingSchedule.length > 0 ? editingSchedule[editingSchedule.length - 1]?.teamB || '' : ''} 
                      onChange={e => {
                        const newSchedule = [...editingSchedule];
                        if (newSchedule.length === 0) {
                          newSchedule.push({ teamA: '', teamB: e.target.value, date: '', venue: '', matchTitle: '', matchId: '', status: 'scheduled' });
                        } else {
                          newSchedule[newSchedule.length - 1].teamB = e.target.value;
                        }
                        setEditingSchedule(newSchedule);
                      }}
                      placeholder="e.g. MI"
                    />
                  </div>
                </div>
                <div className="cp-dual-row">
                  <div className="cp-form-row">
                    <label>Date</label>
                    <input 
                      type="date"
                      value={editingSchedule.length > 0 ? editingSchedule[editingSchedule.length - 1]?.date || '' : ''} 
                      onChange={e => {
                        const newSchedule = [...editingSchedule];
                        if (newSchedule.length === 0) {
                          newSchedule.push({ teamA: '', teamB: '', date: e.target.value, venue: '', matchTitle: '', matchId: '', status: 'scheduled' });
                        } else {
                          newSchedule[newSchedule.length - 1].date = e.target.value;
                        }
                        setEditingSchedule(newSchedule);
                      }}
                    />
                  </div>
                  <div className="cp-form-row">
                    <label>Venue</label>
                    <input 
                      value={editingSchedule.length > 0 ? editingSchedule[editingSchedule.length - 1]?.venue || '' : ''} 
                      onChange={e => {
                        const newSchedule = [...editingSchedule];
                        if (newSchedule.length === 0) {
                          newSchedule.push({ teamA: '', teamB: '', date: '', venue: e.target.value, matchTitle: '', matchId: '', status: 'scheduled' });
                        } else {
                          newSchedule[newSchedule.length - 1].venue = e.target.value;
                        }
                        setEditingSchedule(newSchedule);
                      }}
                      placeholder="e.g. Chennai"
                    />
                  </div>
                </div>
                <button 
                  className="cp-primary-btn cp-wide-btn" 
                  onClick={() => {
                    const newSchedule = [...editingSchedule];
                    const lastMatch = newSchedule[newSchedule.length - 1];
                    if (lastMatch && lastMatch.teamA && lastMatch.teamB) {
                      lastMatch.matchTitle = `${lastMatch.teamA} vs ${lastMatch.teamB}`;
                      lastMatch.matchId = generateMatchId(lastMatch.teamA, lastMatch.teamB, lastMatch.date ? new Date(lastMatch.date) : undefined);
                      newSchedule.push({ teamA: '', teamB: '', date: '', venue: '', matchTitle: '', matchId: '', status: 'scheduled' });
                      setEditingSchedule(newSchedule);
                    }
                  }}
                >
                  Add Match
                </button>
              </div>
              <div className="cp-manual-section">
                <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--muted)' }}>Schedule ({editingSchedule.filter(m => m.teamA && m.teamB).length} matches)</h3>
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {editingSchedule.filter(m => m.teamA && m.teamB).map((match, idx) => (
                    <div key={idx} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>{match.matchTitle}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{match.date || 'TBD'} • {match.venue || ''}</div>
                      </div>
                      <button 
                        className="cp-glass-btn cp-danger cp-small" 
                        onClick={() => {
                          const newSchedule = editingSchedule.filter((_, i) => i !== idx);
                          setEditingSchedule(newSchedule);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <footer className="cp-results-footer">
              <div className="cp-footer-actions">
                <button className="cp-secondary-btn" onClick={() => setShowScheduleEditor(false)}>Cancel</button>
                <button className="cp-primary-btn" onClick={handleSaveSchedule}>Save Schedule</button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Setup Guide Viewer */}
      {setupGuideViewer.open && setupGuideViewer.type && (
        <SetupGuideViewer
          guideType={setupGuideViewer.type}
          onClose={() => setSetupGuideViewer({ open: false, type: null })}
        />
      )}

      {/* Pause Reason Dialog */}
      {showPauseReasonDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--panel-bg)',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            minWidth: '400px',
            maxWidth: '500px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text)' }}>Pause Predictions</h3>
            <p style={{ margin: '0 0 20px 0', color: 'var(--muted)', fontSize: '14px' }}>
              Optionally provide a reason for pausing predictions. This will be visible to users.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)', fontSize: '14px' }}>
                Pause Reason (Optional)
              </label>
              <textarea
                value={tempPauseReason}
                onChange={e => setTempPauseReason(e.target.value)}
                placeholder="Enter reason for pausing predictions..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--text)',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelPauseReason}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmPauseReason}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--accent-blue)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Pause Predictions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
