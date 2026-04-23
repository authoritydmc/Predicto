import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  getTournamentsBySport, updateTournamentStatus, deleteTournament, deleteMatch, getMatchesByTournament
} from '../firebase/db';
import { getAudienceUrl } from '../utils/shared';
import { getTeamLogoUrl } from '../utils/teamLogos';
import initLogger from '../utils/logger';
import { CricketMatchDetails } from '../components/sports/CricketMatchDetails';
import { FootballMatchDetails } from '../components/sports/FootballMatchDetails';
import { CricketLiveScore } from '../components/sports/CricketLiveScore';
import { FootballLiveScore } from '../components/sports/FootballLiveScore';

// ── LocalStorage Helpers ────────────────────────────────────────────────────────
const STORAGE_KEY = 'controlpanel_ui_state';
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

// ─── Scoring Engines ──────────────────────────────────────────────────────────
const calcInnings1Points = (pred: any, actual: number, meta: any) => {
  const useA = !meta.disableScoreA && meta.disableScoreB;
  const useB = !meta.disableScoreB && meta.disableScoreA;
  let predScore = 0;
  if (useA) predScore = Number(pred.scoreA) || 0;
  else if (useB) predScore = Number(pred.scoreB) || 0;
  else {
    const w = (pred.predictedWinner || '').toLowerCase();
    const tA = (meta.teamA || '').toLowerCase();
    const tB = (meta.teamB || '').toLowerCase();
    if (w === tA) predScore = Number(pred.scoreA) || 0;
    else if (w === tB) predScore = Number(pred.scoreB) || 0;
    else predScore = Math.max(Number(pred.scoreA) || 0, Number(pred.scoreB) || 0);
  }
  const diff = Math.abs(actual - predScore);
  if (diff === 0) return { points: 200, diff, rawDiff: 0, isExact: true, guess: predScore, mode: 'Score' };
  const base = Math.round(Math.max(0, 120 - diff * 1.2));
  const near5 = diff <= 5 ? 20 : 0;
  const near10 = diff <= 10 ? 10 : 0;
  return { points: base + near5 + near10, diff, rawDiff: diff, isExact: false, isNear5: diff <= 5, isNear10: diff <= 10, guess: predScore, mode: 'Score' };
};

const calcInnings2Points = (pred: any, actualWinner: string, actualResult: string | number, meta: any, isOvers: boolean) => {
  const tA = (meta.teamA || 'Team A').toLowerCase();
  const tB = (meta.teamB || 'Team B').toLowerCase();
  let chasingTeam = tB;
  if (meta.disableScoreA && !meta.disableScoreB) chasingTeam = tB;
  else if (meta.disableScoreB && !meta.disableScoreA) chasingTeam = tA;
  const predWinner = (pred.predictedWinner || '').toLowerCase();
  const predVal = chasingTeam === tA ? pred.scoreA : pred.scoreB;
  if (predWinner !== actualWinner) {
    let wrongDiff = 0;
    if (isOvers) {
      wrongDiff = Math.abs(oversToBalls(actualResult) - oversToBalls(predVal || 0));
    } else {
      wrongDiff = Math.abs(Number(actualResult) - Number(predVal || 0));
    }
    return { points: 0, diff: '---', rawDiff: wrongDiff, guess: predVal ?? '---', isExact: false, mode: 'Wrong Winner' };
  }
  if (isOvers) {
    const aB = oversToBalls(actualResult); const pB = oversToBalls(predVal || 0);
    const diff = Math.abs(aB - pB);
    const accuracy = Math.round(Math.max(0, 120 - diff * 1.8));
    const near3 = diff <= 3 ? 20 : 0; const range = diff <= 9 ? 10 : 0; const exact = diff === 0 ? 70 : 0;
    return { points: accuracy + near3 + range + exact, diff: ballsToOversDisplay(diff), rawDiff: diff, guess: predVal, isExact: diff === 0, mode: 'Overs' };
  } else {
    const diff = Math.abs(Number(actualResult) - Number(predVal || 0));
    const base = Math.round(Math.max(0, 120 - diff * 1.2));
    const t1 = diff <= 5 ? 20 : 0; const t2 = diff <= 12 ? 10 : 0; const exact = diff === 0 ? 70 : 0;
    return { points: base + t1 + t2 + exact, diff: `${diff} runs`, rawDiff: diff, guess: Number(predVal || 0), isExact: diff === 0, mode: 'Score' };
  }
};

const calcMatchFinals = (h1: Record<string, any>, h2: Record<string, any>) => {
  const map = new Map<string, any>();
  const merge = (data: Record<string, any>, is1: boolean) =>
    Object.values(data).forEach(p => {
      const key = (p.name || 'Anonymous').toLowerCase().trim();
      if (!map.has(key)) map.set(key, { displayName: p.name || 'Anonymous', p1: { pts: 0, winner: '', guess: '---' }, p2: { pts: 0, winner: '', guess: '---' } });
      const rec = map.get(key);
      if (is1) rec.p1 = { pts: p.points || 0, winner: p.predictedWinner || '', guess: p.guess ?? '---' };
      else rec.p2 = { pts: p.points || 0, winner: p.predictedWinner || '', guess: p.guess ?? '---' };
    });
  merge(h1, true); merge(h2, false);
  return Array.from(map.values()).map(r => {
    const penalty = r.p1.winner && r.p2.winner && r.p1.winner.toLowerCase() !== r.p2.winner.toLowerCase() ? -20 : 0;
    return { name: r.displayName, p1Score: r.p1.pts, p1Winner: r.p1.winner, p1Guess: r.p1.guess, p2Score: r.p2.pts, p2Winner: r.p2.winner, p2Guess: r.p2.guess, penalty, total: Math.max(0, r.p1.pts + r.p2.pts + penalty) };
  });
};

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
    scheduler: false
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
  const [activeMatchTab, setActiveMatchTab] = useState<'details' | 'live'>('details');
  const [isEditingScore, setIsEditingScore] = useState(false);

  // ── Scheduler State
  const [schedulerTasks, setSchedulerTasks] = useState<Record<string, any>>({});
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerLogs, setSchedulerLogs] = useState<any[]>([]);
  const [activeSchedulerTab, setActiveSchedulerTab] = useState<'tasks' | 'logs'>('tasks');

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
  // CSV Upload Handler
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!tournamentId) {
      alert('Please select a tournament first before uploading a schedule');
      e.target.value = '';
      return;
    }
    
    if (!fSport) {
      alert('Please select a sport first before uploading a schedule');
      e.target.value = '';
      return;
    }
    
    setCsvFile(file);
    setUploadingSchedule(true);
    
    try {
      const text = await file.text();
      console.log('CSV Content:', text.substring(0, 500));
      
      const parsedSchedule = parseCSV(text);
      console.log('Parsed Schedule:', parsedSchedule);
      
      if (parsedSchedule.length === 0) {
        alert('No matches found in CSV file. Please check the format.\n\nExpected CSV format:\nteamA,teamB,date,venue,matchTitle\nCSK,MI,2024-03-15,Mumbai,CSK vs MI');
        return;
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
      
      alert(`Successfully parsed and saved ${transformedSchedule.length} matches from CSV`);
    } catch (err) {
      console.error('CSV Upload Error:', err);
      alert('Error parsing CSV file: ' + (err as Error).message);
    } finally {
      setUploadingSchedule(false);
      e.target.value = '';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Match
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate tournament selection
    if (!tournamentId) {
      alert('Please select a valid tournament first before creating a match');
      return;
    }
    
    // Validate tournament exists in available tournaments
    const tournamentExists = availableTournaments.some(t => t.tournamentId === tournamentId);
    if (!tournamentExists) {
      alert('Invalid tournament selected. Please select a valid tournament from the list.');
      return;
    }
    
    const mCode = normalizeRoomId(fMatchCode);
    const mId = mCode;
    const tId = tournamentId;
    
    try {
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
          status: fMatchStatus,
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
      alert(`Match [${fMatchTitle || `${fTeamA} vs ${fTeamB}`}] created with code: ${mId}`);
    } catch (err) { console.error(err); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Live Score Update (Manual button)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleUpdateLiveScore = async () => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) {
      alert('Please select a match first');
      return;
    }

    try {
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
      alert('Live score updated successfully');
    } catch (err) {
      console.error(err);
      alert('Error updating live score');
    }
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
      const result = await window.overlayDesktop.runScraper(fSport, matchId, fTeamA, fTeamB, scraperOrder);
      
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
              const battingTeam = fBattingTeam;
              const relevantPrediction = predictionsArray.find((p: any) => {
                if (meta?.status === 'scheduled') {
                  // For scheduled matches, use the predicted batting first
                  return p.predictedBattingFirst === battingTeam;
                } else if (meta?.status === 'live') {
                  // For live matches, determine batting first from disableScore flags
                  const actualBattingFirst = meta?.disableScoreA === false ? 'teamA' : meta?.disableScoreB === false ? 'teamB' : null;
                  return p.battingFirst === actualBattingFirst;
                }
                return false;
              });
              
              if (relevantPrediction) {
                const scoreStr = battingTeam === 'teamA' ? relevantPrediction.scoreA : relevantPrediction.scoreB;
                if (scoreStr) {
                  // Parse score string like "185/4"
                  const parts = scoreStr.split('/');
                  setScoreTeamARuns(battingTeam === 'teamA' ? parts[0] || '' : '');
                  setScoreTeamAWickets(battingTeam === 'teamA' ? parts[1] || '' : '');
                  setScoreTeamBRuns(battingTeam === 'teamB' ? parts[0] || '' : '');
                  setScoreTeamBWickets(battingTeam === 'teamB' ? parts[1] || '' : '');
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
  const resolveMatch = async () => {
    if (!isFirebaseConfigured || !db) return;
    const rid = normalizeRoomId(fRoomId || roomId);
    let actualVal: any; let actualWinner = '';

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
      // @ts-ignore
      setResultsOpen(true);
    } catch (err) { console.error(err); alert('Error resolving match.'); }
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
    if (!confirm('End match? Standings archived and live room cleared.')) return;
    try {
      const h1Snap = await getOnce(matchRef(fSport, tournamentId, matchId, 'innings_history/1st'));
      const h2Snap = await getOnce(matchRef(fSport, tournamentId, matchId, 'innings_history/2nd'));
      const h1 = h1Snap.val() || {}; const h2 = h2Snap.val() || {};
      const finalStandings = calcMatchFinals(h1, h2);
      const dateKey = `${new Date().toISOString().split('T')[0]}_${Date.now()}`;
      await update(matchRef(fSport, tournamentId, matchId, `history/${dateKey}`), { matchTitle: fMatchTitle || 'Unnamed Match', teamA: fTeamA, teamB: fTeamB, innings1: h1, innings2: h2, finalStandings });
      await update(matchPredictionsRef(fSport, tournamentId, matchId), {});
      await update(matchMetaRef(fSport, tournamentId, matchId), { resolved: true, status: 'done', endedAt: Date.now() });
      setOverallOpen(false);
      setResultsOpen(false);
      setFActualScore(''); setFActualResult('');
      alert('Match ended and archived.');
    } catch (err) { console.error(err); alert('Error ending match.'); }
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
                    <div className="cp-form-row">
                      <label className="cp-toggle-row">
                        <span>Allow re-prediction</span>
                        <Toggle checked={fAllowReprediction} onChange={setFAllowReprediction} />
                      </label>
                    </div>
                    <div className="cp-form-row">
                      <label className="cp-toggle-row" title="When ON, all cloud automated polling and resolving will stop.">
                        <span style={{ color: 'var(--accent-blue)' }}>Cloud Bot Override (Pause Automation)</span>
                        <Toggle checked={fAutomationPaused} onChange={setFAutomationPaused} />
                      </label>
                    </div>

                    {/* Prediction Controls Section */}
                    <div className="cp-section-header">
                      <span>Prediction Controls</span>
                    </div>
                    <div className="cp-form-row">
                      <label className="cp-toggle-row" title="Enable or disable predictions for this match">
                        <span>Enable Predictions</span>
                        <Toggle checked={fPredictionsEnabled} onChange={setFPredictionsEnabled} />
                      </label>
                    </div>
                    <div className="cp-form-row">
                      <label className="cp-toggle-row" title="Temporarily pause predictions (requires predictions to be enabled)">
                        <span>Pause Predictions</span>
                        <Toggle checked={fPredictionsPaused} onChange={setFPredictionsPaused} />
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
                        />
                      </div>
                    )}
                    
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

                    {/* Prediction Controls - Only show for live/done matches */}
                    {(fMatchStatus === 'live' || fMatchStatus === 'done') && (
                      <>
                        <div className="cp-section-header">
                          <span>Prediction Controls</span>
                        </div>
                        <div className="cp-form-row">
                          <label className="cp-toggle-row" title="Enable or disable predictions for this match">
                            <span>Enable Predictions</span>
                            <Toggle checked={fPredictionsEnabled} onChange={setFPredictionsEnabled} />
                          </label>
                        </div>
                        <div className="cp-form-row">
                          <label className="cp-toggle-row" title="Temporarily pause predictions (requires predictions to be enabled)">
                            <span>Pause Predictions</span>
                            <Toggle checked={fPredictionsPaused} onChange={setFPredictionsPaused} />
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
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Scheduled Match Note */}
                    {fMatchStatus === 'scheduled' && (
                      <div style={{
                        padding: '12px 16px',
                        background: 'rgba(255, 159, 10, 0.1)',
                        border: '1px solid rgba(255, 159, 10, 0.3)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: '#ff9f0a',
                        marginTop: '8px',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>ℹ️</span>
                          <span>For scheduled matches, use the Match Control tab to set toss, batting team, and live score when the match starts.</span>
                        </span>
                      </div>
                    )}
                    
                    {/* Sport-specific Match Details */}
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
                    <button className="cp-primary-btn cp-wide-btn" type="submit">{matchId ? 'Update Match' : 'Create Match & Connect'}</button>
                  </form>
                </div>

                {/* Live Score Tab */}
                <div className={`cp-tab-content ${activeMatchTab === 'live' ? 'active' : ''}`}>
                  <div className="cp-form-row">
                    <label>Match Status</label>
                    <select value={scoreMatchStatus} onChange={e => setScoreMatchStatus(e.target.value as any)}>
                      <option value="live">Live</option>
                      <option value="completed">Completed</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>
                  <div className="cp-form-row">
                    <label>Source</label>
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
                  <p className="cp-panel-note">Updates will be reflected in real-time on the audience match page.</p>
                </div>
              </>
            )}
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
            <p className="cp-panel-note">Resolve the current innings to archive points and prepare for the final report.</p>
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
            <h2 className="cp-group-title" style={{ margin: 0 }}>Automation Scheduler</h2>
            <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
              {collapsedSections.scheduler ? '▶' : '▼'}
            </span>
          </div>
          <div className="cp-glass-card" style={{ display: collapsedSections.scheduler ? 'none' : 'block' }}>
            {/* Scheduler Status */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 600 }}>
                  Scheduler Status
                </span>
                <span className={`cp-dot ${schedulerRunning ? 'active' : 'inactive'}`} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
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
                <button className="cp-primary-btn" onClick={handlePrepNext}>
                  {is2nd ? 'Final Resolve & Clear Room' : 'Clear All & Prep 2nd Innings'}
                </button>
              </div>
              <p className="cp-footer-note">Prep handles archiving this innings and switching teams.</p>
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
    </div>
  );
};

export default ControlPanel;
