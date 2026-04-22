import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  db, isFirebaseConfigured, onValue, query, ref, roomRef,
  saveRoomMeta, clearRoomNode, getOnce, setDiscovery,
  saveInningsHistory, getInningsHistory, archiveToHistory,
  getHistory, wipeMatchData, saveSeasonLeaderboard, updateActiveSession, getDbRoot
} from '../firebase/db';
import { getAudienceUrl } from '../utils/shared';

// ─── Utilities ────────────────────────────────────────────────────────────────
const normalizeRoomId = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 40) || 'ipl';

const escapeHtml = (v = '') =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Dynamic Audience URL is handled via getAudienceUrl(roomId)

const oversToBalls = (val: string | number) => {
  const num = Number(val || 0);
  const overs = Math.floor(num);
  const balls = Math.round((num - overs) * 10);
  return overs * 6 + balls;
};

const ballsToOversDisplay = (balls: number) =>
  `${Math.floor(balls / 6)}.${balls % 6} ov`;

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
  // ── Settings & Meta State
  const [settings, setSettings] = useState<any>(null);
  const [meta, setMeta] = useState<any>({});
  const [roomId, setRoomId] = useState('ipl');

  // ── Form State
  const [fRoomId, setFRoomId] = useState('ipl');
  const [fSport, setFSport] = useState('cricket');
  const [fMatchTitle, setFMatchTitle] = useState('');
  const [fTeamA, setFTeamA] = useState('');
  const [fTeamB, setFTeamB] = useState('');
  const [fBattingTeam, setFBattingTeam] = useState<'home' | 'away'>('home');
  const [fInnings, setFInnings] = useState<'1' | '2'>('1');
  const [fAllowReprediction, setFAllowReprediction] = useState(false);
  const [fAutomationPaused, setFAutomationPaused] = useState(false);

  // ── Resolution
  const [fActualScore, setFActualScore] = useState('');
  const [fChaserWon, setFChaserWon] = useState<'yes' | 'no'>('no');
  const [fActualResult, setFActualResult] = useState('');

  // ── Win Prob
  const [googleUrl, setGoogleUrl] = useState('');
  const [autoFetch, setAutoFetch] = useState(false);
  const [showWinProb, setShowWinProb] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('Status: Not started');

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

  // ─────────────────────────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // @ts-ignore
      const s = await window.overlayDesktop.getSettings();
      setSettings(s);
      setOpacity(s.opacity ?? 1);
      setReactionOpacity(s.reactionOpacity ?? 1);
      const rid = normalizeRoomId(s.roomId || 'ipl');
      setRoomId(rid);
      setFRoomId(rid);
      subscribeToMeta(rid);
    };
    init();

    // @ts-ignore
    window.overlayDesktop.onSettingsChanged((s: any) => {
      setSettings(s);
      setOpacity(s.opacity ?? 1);
      const rid = normalizeRoomId(s.roomId || 'ipl');
      setRoomId(rid);
      setFRoomId(rid);
      subscribeToMeta(rid);
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Firebase Meta Subscription
  // ─────────────────────────────────────────────────────────────────────────────
  const subscribeToMeta = useCallback((rid: string) => {
    if (unsubMetaRef.current) unsubMetaRef.current();
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    if (!isFirebaseConfigured || !db) return;

    const tick = () => updateActiveSession(rid).catch(console.error);
    tick();
    heartbeatRef.current = setInterval(tick, 20000);

    const metaRef = roomRef(rid, 'meta'); // In db.ts now simplified or need to handle sport locally
    // Since roomRef was changed or removed, let's use the new schemaRef logic if accessible
    // @ts-ignore (need to confirm what db.ts exports, but matchMetaRef is safe)
    unsubMetaRef.current = onValue(matchMetaRef(fSport, rid), snap => {
      const m = snap.val() || {};
      setMeta(m);
      setFMatchTitle(m.matchTitle || '');
      setFTeamA(m.teamA || '');
      setFTeamB(m.teamB || '');
      setFAllowReprediction(Boolean(m.allowReprediction));
      setFAutomationPaused(Boolean(m.automationPaused));
      setGoogleUrl(m.googleMatchUrl || '');
      setShowWinProb(Boolean(m.showWinProb));
      if (!m.disableScoreA && m.disableScoreB) setFBattingTeam('home');
      else if (!m.disableScoreB && m.disableScoreA) setFBattingTeam('away');
      setFInnings(m.secondInnings ? '2' : '1');
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Computed from Form/Meta
  // ─────────────────────────────────────────────────────────────────────────────
  const is2nd = fInnings === '2';
  const chasingTeam = (() => {
    const tA = fTeamA || 'Team A'; const tB = fTeamB || 'Team B';
    if (meta.disableScoreA && !meta.disableScoreB) return tB;
    if (meta.disableScoreB && !meta.disableScoreA) return tA;
    return fBattingTeam === 'home' ? tB : tA;
  })();

  const getFormMeta = () => ({
    matchTitle: fMatchTitle,
    teamA: fTeamA,
    teamB: fTeamB,
    allowReprediction: fAllowReprediction,
    disableScoreA: fBattingTeam === 'away',
    disableScoreB: fBattingTeam === 'home',
    secondInnings: is2nd,
    predictionSort: meta.predictionSort || 'newest',
    predictionsPaused: Boolean(meta.predictionsPaused),
    hideChat: Boolean(meta.hideChat),
    hideJoin: Boolean(meta.hideJoin),
    automationPaused: fAutomationPaused
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Deploy Form
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    const rid = normalizeRoomId(fRoomId);
    try {
      // 1. Establish Discovery
      await setDiscovery(rid, fSport, rid);
      
      // 2. Update Local Settings
      // @ts-ignore
      const nextS = await window.overlayDesktop.updateSettings({ roomId: rid, sport: fSport, opacity });
      setSettings(nextS);
      setRoomId(rid);
      
      // 3. Save Tournament Meta
      if (isFirebaseConfigured && db) {
        await saveRoomMeta(fSport, rid, getFormMeta());
      }
      
      subscribeToMeta(rid);
      // @ts-ignore
      await window.overlayDesktop.reloadOverlay();
      alert(`Tournament context [${fSport}/${rid}] deployed!`);
    } catch (err) { console.error(err); }
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
        if (isFirebaseConfigured && db) {
          const rid = normalizeRoomId(fRoomId);
          await saveRoomMeta(fSport, rid, { winProbabilityA: parseInt(result.probA), winProbabilityB: parseInt(result.probB) });
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
    if (isFirebaseConfigured && db) await saveRoomMeta(fSport, normalizeRoomId(fRoomId), { showWinProb: v });
  };

  const handleGoogleUrlSave = async () => {
    if (isFirebaseConfigured && db) await saveRoomMeta(fSport, normalizeRoomId(fRoomId), { googleMatchUrl: googleUrl.trim() });
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
    if (!isFirebaseConfigured || !db) return;
    const rid = normalizeRoomId(fRoomId || roomId);
    if (!confirm(`Clear ALL ${node} for room ${rid}?`)) return;
    try { await clearRoomNode(fSport, rid, node); } catch (err) { console.error(err); }
  };

  const togglePredictionPause = async () => {
    const rid = normalizeRoomId(fRoomId || roomId);
    const next = !Boolean(meta.predictionsPaused);
    const m = { ...getFormMeta(), predictionsPaused: next };
    await saveRoomMeta(fSport, rid, m);
    // @ts-ignore
    await window.overlayDesktop.reloadOverlay();
  };

  const toggleHideChat = async () => {
    const rid = normalizeRoomId(fRoomId || roomId);
    await saveRoomMeta(fSport, rid, { ...getFormMeta(), hideChat: !Boolean(meta.hideChat) });
  };

  const toggleHideJoin = async () => {
    const rid = normalizeRoomId(fRoomId || roomId);
    await saveRoomMeta(fSport, rid, { ...getFormMeta(), hideJoin: !Boolean(meta.hideJoin) });
  };

  const toggleSortMode = async () => {
    const rid = normalizeRoomId(fRoomId || roomId);
    const next = (meta.predictionSort || 'newest') === 'newest' ? 'score' : 'newest';
    await saveRoomMeta(fSport, rid, { ...getFormMeta(), predictionSort: next });
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
    setFBattingTeam('home'); setFInnings('1');
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
      const snap = await getOnce(matchPredictionsRef(fSport, rid));
      const predData = snap.val() || {};
      const preds = Object.entries(predData);
      if (!preds.length) { alert('No predictions found.'); return; }

      const results = preds.map(([cid, p]: [string, any]) => {
        const res = is2nd
          ? calcInnings2Points(p, actualWinner, actualVal, { teamA: fTeamA, teamB: fTeamB, disableScoreA: meta.disableScoreA, disableScoreB: meta.disableScoreB }, fActualResult.includes('.'))
          : calcInnings1Points(p, actualVal, { teamA: fTeamA, teamB: fTeamB, disableScoreA: meta.disableScoreA, disableScoreB: meta.disableScoreB });
        return { clientId: cid, name: p.name || 'Anonymous', ...res, originalPrediction: p };
      });

      const sorted = [...results].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.points === 0 && b.points === 0) return (a.rawDiff ?? Infinity) - (b.rawDiff ?? Infinity);
        return 0;
      });
      setLastResults(sorted);

      const winLabel = is2nd ? `${actualWinner.toUpperCase()} WIN (${actualVal})` : String(actualVal);
      setResActualScore(winLabel);
      setResolveTitle(is2nd ? '2nd Innings Results' : '1st Innings Leaderboard');
      setResultsOpen(true);
    } catch (err) { console.error(err); alert('Error resolving match.'); }
  };

  const handlePrepNext = async () => {
    const rid = normalizeRoomId(fRoomId || roomId);
    const label = is2nd ? '2nd' : '1st';
    if (!confirm(`Finalize ${label} innings and archive results?`)) return;
    try {
      if (lastResults.length > 0) {
        const payload: Record<string, any> = {};
        lastResults.forEach(r => { payload[r.clientId || `legacy-${r.name}`] = { name: r.name, points: r.points, guess: r.guess, predictedWinner: r.originalPrediction?.predictedWinner || '' }; });
        await saveInningsHistory(fSport, rid, label, payload);
      }
      await clearRoomNode(fSport, rid, 'predictions');
      if (!is2nd) {
        const nextMeta = { ...getFormMeta(), secondInnings: true };
        const battingHome = !meta.disableScoreA;
        nextMeta.disableScoreA = battingHome;
        nextMeta.disableScoreB = !battingHome;
        await saveRoomMeta(fSport, rid, nextMeta);
        alert('Results Archived! Stages switched and Batting Team swapped.');
      } else {
        alert('Match Finalized! View Final standings for full results.');
      }
      setResultsOpen(false);
      setFActualScore(''); setFActualResult('');
    } catch (err) { console.error(err); alert('Error finalizing stage.'); }
  };

  const viewFinalStandings = async () => {
    const rid = normalizeRoomId(fRoomId || roomId);
    try {
      const history = await getInningsHistory(fSport, rid);
      const h1 = history['1st'] || {}; const h2 = history['2nd'] || {};
      if (!Object.keys(h1).length && !Object.keys(h2).length) { alert('No innings data found yet.'); return; }
      const overall = calcMatchFinals(h1, h2).sort((a, b) => b.total - a.total);
      setLastOverall(overall);
      setOverallOpen(true);
    } catch (err) { console.error(err); alert('Error fetching standings.'); }
  };

  const handleEndMatch = async () => {
    const rid = normalizeRoomId(fRoomId || roomId);
    if (!confirm('End match? Standings archived and live room cleared.')) return;
    try {
      const history = await getInningsHistory(fSport, rid);
      const h1 = history['1st'] || {}; const h2 = history['2nd'] || {};
      const finalStandings = calcMatchFinals(h1, h2);
      const dateKey = `${new Date().toISOString().split('T')[0]}_${Date.now()}`;
      await archiveToHistory(fSport, rid, dateKey, { matchTitle: fMatchTitle || 'Unnamed Match', teamA: fTeamA, teamB: fTeamB, innings1: h1, innings2: h2, finalStandings });
      await updateSeasonLeaderboard(rid);
      await wipeMatchData(fSport, rid);
      setOverallOpen(false);
      alert('Match Archived and Live Room Reset.');
    } catch (err) { console.error(err); alert('Error archiving match.'); }
  };

  const updateSeasonLeaderboard = async (rid: string) => {
    const history = await getHistory(rid);
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
    const rid = normalizeRoomId(fRoomId || roomId);
    setHistoryOpen(true);
    try {
      const h = await getHistory(fSport, rid);
      setFullHistory(h || {});
      showSeasonStats(h || {}, rid);
    } catch (err) { console.error(err); }
  };

  const showSeasonStats = async (h?: Record<string, any>, rid?: string) => {
    const history = h || fullHistory;
    const seasonMap = new Map<string, any>();
    Object.values(history).forEach((match: any) => {
      (match.finalStandings || []).forEach((r: any) => {
        const key = r.name.trim().toLowerCase();
        if (!seasonMap.has(key)) seasonMap.set(key, { name: r.name, total: 0, matchCount: 0 });
        const p = seasonMap.get(key); p.total += r.total || 0; p.matchCount += 1;
      });
    });
    const players = Array.from(seasonMap.values()).map(p => ({ ...p, ppg: +(p.total / (p.matchCount || 1)).toFixed(2) }));
    const sorted = players.sort((a, b) => seasonSortMode === 'ppg' ? b.ppg - a.ppg : b.total - a.total);
    setActiveHistoryKey('season');
    setHistoryDetail(
      <div className="history-section">
        <div className="history-section-title">Season Standings</div>
        <div className="season-sort-toggle">
          <span className={`sort-item${seasonSortMode === 'total' ? ' active' : ''}`} onClick={() => setSeasonSortMode('total')}>Total Points</span>
          <span className={`sort-item${seasonSortMode === 'ppg' ? ' active' : ''}`} onClick={() => setSeasonSortMode('ppg')}>Points Per Match</span>
        </div>
        <table className="results-table">
          <thead><tr><th>Rank</th><th>Name</th><th style={{ textAlign: 'center' }}>Games</th><th style={{ textAlign: 'right' }}>Points</th></tr></thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.name}>
                <td><RankPill rank={i + 1} /></td>
                <td><div style={{ fontWeight: 700 }}>{s.name}</div><div className="ppg-label">{s.ppg} pts/game</div></td>
                <td style={{ textAlign: 'center' }}><span className="match-badge">{s.matchCount}</span></td>
                <td style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent-blue)', textAlign: 'right' }}>{seasonSortMode === 'ppg' ? s.ppg : s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
    const url = getAudienceUrl(roomId);
    // @ts-ignore
    window.overlayDesktop.openExternal(url);
  };

  const copyAudienceUrl = async () => {
    try {
      const url = getAudienceUrl(roomId);
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
      {/* ── Header ── */}
      <header className="cp-header">
        <div className="cp-header-main">
          <div className="cp-header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="cp-badge">Executive</span>
              <span className={`cp-badge ${fSport === 'cricket' ? 'cp-badge-local' : 'cp-badge-prod'}`} style={{ 
                background: fSport === 'cricket' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(236, 72, 153, 0.2)',
                color: fSport === 'cricket' ? '#818cf8' : '#f472b6',
                border: fSport === 'cricket' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(236, 72, 153, 0.3)'
              }}>
                {fSport.toUpperCase()}
              </span>
              <span className={`cp-badge ${getDbRoot() === 'local' ? 'cp-badge-local' : 'cp-badge-prod'}`} style={{ 
                background: getDbRoot() === 'local' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: getDbRoot() === 'local' ? '#818cf8' : '#34d399',
                border: getDbRoot() === 'local' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                {getDbRoot().toUpperCase()}
              </span>
            </div>
            <h1>Control Panel</h1>
            <p>Managing {fMatchTitle || 'Active Session'}</p>
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
              Advanced Debug Log
            </button>
            <button className="cp-action-btn cp-pill" onClick={openHistory}>
              <span>📚</span> View Match History
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>LIVE AUDIENCE LINK</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: '0.01em' }}>
              {getAudienceUrl(roomId)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cp-action-btn cp-small" onClick={openAudienceUrl} style={{ background: 'rgba(255,255,255,0.05)' }}>Open Browser</button>
            <button className="cp-glass-btn cp-small" onClick={copyAudienceUrl}>Copy Link</button>
          </div>
        </div>
      </header>

      <div className="cp-content-grid">

        {/* ── Match Configuration ── */}
        <section className="cp-panel-group">
          <h2 className="cp-group-title">Match Configuration</h2>
          <div className="cp-glass-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="cp-action-btn cp-pill cp-small" onClick={loadTodayMatch}>🤖 Load Today's Match</button>
            </div>
              <div className="cp-dual-row">
                <div className="cp-form-row">
                  <label>Room Identity / Tournament ID</label>
                  <input id="roomId" value={fRoomId} onChange={e => setFRoomId(e.target.value)} maxLength={40} placeholder="e.g. ipl" required />
                </div>
                <div className="cp-form-row">
                  <label>Sport Architecture</label>
                  <select value={fSport} onChange={e => setFSport(e.target.value)}>
                    <option value="cricket">Cricket (Innings-based)</option>
                    <option value="football">Football (Time-based)</option>
                    <option value="generic">Generic (Score-based)</option>
                  </select>
                </div>
              </div>
              <div className="cp-form-row">
                <label>Broadcast Title</label>
                <input id="matchTitle" value={fMatchTitle} onChange={e => setFMatchTitle(e.target.value)} maxLength={60} placeholder="Match #001" required />
              </div>
              <div className="cp-dual-row">
                <div className="cp-form-row">
                  <label>Home Team</label>
                  <input id="teamA" value={fTeamA} onChange={e => setFTeamA(e.target.value)} maxLength={30} placeholder="Team A" required />
                </div>
                <div className="cp-form-row">
                  <label>Away Team</label>
                  <input id="teamB" value={fTeamB} onChange={e => setFTeamB(e.target.value)} maxLength={30} placeholder="Team B" required />
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
              <div className="cp-form-row">
                <label>Batting Team (Active Predictions)</label>
                <div className="cp-radio-group">
                  <div className="cp-radio-option">
                    <input type="radio" id="battingA" name="battingTeam" value="home" checked={fBattingTeam === 'home'} onChange={() => setFBattingTeam('home')} />
                    <label className="cp-radio-label" htmlFor="battingA">{fTeamA || 'Home Team'}</label>
                  </div>
                  <div className="cp-radio-option">
                    <input type="radio" id="battingB" name="battingTeam" value="away" checked={fBattingTeam === 'away'} onChange={() => setFBattingTeam('away')} />
                    <label className="cp-radio-label" htmlFor="battingB">{fTeamB || 'Away Team'}</label>
                  </div>
                </div>
              </div>
              <div className="cp-form-row">
                <label>Current Innings</label>
                <div className="cp-radio-group">
                  <div className="cp-radio-option">
                    <input type="radio" id="innings1st" name="innings" value="1" checked={fInnings === '1'} onChange={() => setFInnings('1')} />
                    <label className="cp-radio-label" htmlFor="innings1st">1st Innings</label>
                  </div>
                  <div className="cp-radio-option">
                    <input type="radio" id="innings2nd" name="innings" value="2" checked={fInnings === '2'} onChange={() => setFInnings('2')} />
                    <label className="cp-radio-label" htmlFor="innings2nd">2nd Innings</label>
                  </div>
                </div>
              </div>
              <div className="cp-divider" />
              <button className="cp-primary-btn cp-wide-btn" type="submit">Deploy Changes & Connect Room</button>
            </form>
            </form>
          </div>
        </section>

        {/* ── Match Resolution ── */}
        <section className="cp-panel-group">
          <h2 className="cp-group-title">Match Resolution</h2>
          <div className="cp-glass-card cp-stack">
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
          <h2 className="cp-group-title">Live Win Probability (Google)</h2>
          <div className="cp-glass-card cp-stack">
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

        {/* ── Window & Engine ── */}
        <section className="cp-panel-group">
          <h2 className="cp-group-title">Window &amp; Engine</h2>
          <div className="cp-glass-card cp-stack">
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
          MANUAL ENTRY
      ══════════════════════════════════════════════════════════════════════ */}
      {manualOpen && (
        <div className="cp-overlay">
          <div className="cp-history-content cp-glass-card cp-manual-entry-content">
            <header className="cp-results-header">
              <div>
                <span className="cp-badge cp-badge-warning">Admin Tool</span>
                <h2>Manual Match Resolve</h2>
              </div>
              <button className="cp-close-btn" onClick={() => setManualOpen(false)}>&times;</button>
            </header>
            <div className="cp-manual-layout cp-stack">
              <div className="cp-manual-section cp-glass-card">
                <div className="cp-section-hint">Match Setup &amp; Actual Results</div>
                <div className="cp-dual-row">
                  <div className="cp-form-row"><label>Date</label><input type="date" value={manDate} onChange={e => setManDate(e.target.value)} /></div>
                  <div className="cp-form-row"><label>Match Title</label><input type="text" value={manTitle} onChange={e => setManTitle(e.target.value)} placeholder="#RCBvsSRH" /></div>
                </div>
                <div className="cp-dual-row" style={{ marginTop: 12 }}>
                  <div className="cp-form-row"><label>Team A (Home)</label><input type="text" value={manTeamA} onChange={e => setManTeamA(e.target.value)} placeholder="RCB" /></div>
                  <div className="cp-form-row"><label>Team B (Away)</label><input type="text" value={manTeamB} onChange={e => setManTeamB(e.target.value)} placeholder="SRH" /></div>
                </div>
                <div className="cp-divider" style={{ margin: '20px 0' }} />
                <div className="cp-dual-row">
                  <div className="cp-form-row"><label>Actual 1st Inn Score</label><input type="number" value={manActual1st} onChange={e => setManActual1st(e.target.value)} placeholder="e.g. 201" /></div>
                  <div className="cp-form-row">
                    <label>Actual Winner</label>
                    <div className="cp-radio-group">
                      <div className="cp-radio-option">
                        <input type="radio" id="manWinA" name="manualWinner" value="a" checked={manWinner === 'a'} onChange={() => setManWinner('a')} />
                        <label className="cp-radio-label" htmlFor="manWinA">{manTeamA || 'Team A'}</label>
                      </div>
                      <div className="cp-radio-option">
                        <input type="radio" id="manWinB" name="manualWinner" value="b" checked={manWinner === 'b'} onChange={() => setManWinner('b')} />
                        <label className="cp-radio-label" htmlFor="manWinB">{manTeamB || 'Team B'}</label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="cp-form-row" style={{ marginTop: 12 }}>
                  <label>Actual 2nd Inn Result (Score or Overs)</label>
                  <input type="text" value={manActual2nd} onChange={e => setManActual2nd(e.target.value)} placeholder="e.g. 15.4 or 145" />
                </div>
              </div>
              <div className="cp-manual-section cp-glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="cp-section-hint">Player Predictions</div>
                  <button className="cp-action-btn cp-small" onClick={addManualRow}>Add Player Row</button>
                </div>
                <div className="cp-results-table-container" style={{ flex: 1 }}>
                  <table className="cp-results-table" id="manualPlayersTable">
                    <thead><tr><th>Name</th><th>1st Inn Guess</th><th>1st Winner</th><th>2nd Inn Guess</th><th>2nd Winner</th><th></th></tr></thead>
                    <tbody>
                      {manRows.map((row, i) => (
                        <tr key={i}>
                          <td><input type="text" value={row.name} onChange={e => updateManRow(i, 'name', e.target.value)} placeholder="Name" /></td>
                          <td><input type="number" value={row.p1Guess} onChange={e => updateManRow(i, 'p1Guess', e.target.value)} placeholder="Guess" /></td>
                          <td>
                            <select value={row.win1} onChange={e => updateManRow(i, 'win1', e.target.value)}>
                              <option value="a">{manTeamA || 'Team A'}</option>
                              <option value="b">{manTeamB || 'Team B'}</option>
                            </select>
                          </td>
                          <td><input type="text" value={row.p2Guess} onChange={e => updateManRow(i, 'p2Guess', e.target.value)} placeholder="Score/Ov" /></td>
                          <td>
                            <select value={row.win2} onChange={e => updateManRow(i, 'win2', e.target.value)}>
                              <option value="a">{manTeamA || 'Team A'}</option>
                              <option value="b">{manTeamB || 'Team B'}</option>
                            </select>
                          </td>
                          <td><button className="cp-remove-row-btn" onClick={() => removeManRow(i)}>&times;</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <footer className="cp-results-footer">
              <div className="cp-footer-actions">
                <button className="cp-secondary-btn" onClick={() => setManualOpen(false)}>Cancel</button>
                <button className="cp-primary-btn" onClick={saveManualMatch}>Calculate &amp; Archive Match</button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT MATCH MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {editOpen && (
        <div className="cp-overlay" style={{ zIndex: 3000 }}>
          <div className="cp-glass-card" style={{ maxWidth: 600, width: '100%' }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Edit Match Results</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '5px 0 0' }}>Updating results will recalculate all player points.</p>
            </div>
            <div className="cp-dual-row">
              <div className="cp-form-row" style={{ gridColumn: 'span 2' }}><label>Match Title</label><input type="text" value={editMatchTitle} onChange={e => setEditMatchTitle(e.target.value)} /></div>
            </div>
            <div className="cp-dual-row" style={{ marginTop: 12 }}>
              <div className="cp-form-row"><label>Date</label><input type="date" value={editMatchDate} onChange={e => setEditMatchDate(e.target.value)} /></div>
              <div className="cp-form-row"><label>Actual 1st Innings Score</label><input type="number" value={editActual1st} onChange={e => setEditActual1st(e.target.value)} /></div>
            </div>
            <div className="cp-dual-row" style={{ marginTop: 12 }}>
              <div className="cp-form-row"><label>Team A Name</label><input type="text" value={editTeamA} onChange={e => setEditTeamA(e.target.value)} /></div>
              <div className="cp-form-row"><label>Team B Name</label><input type="text" value={editTeamB} onChange={e => setEditTeamB(e.target.value)} /></div>
            </div>
            <div className="cp-dual-row" style={{ marginTop: 12 }}>
              <div className="cp-form-row"><label>Actual 2nd Innings Result</label><input type="text" value={editActual2nd} onChange={e => setEditActual2nd(e.target.value)} placeholder="e.g. 18.2 or 165" /></div>
              <div className="cp-form-row">
                <label>Actual Winner</label>
                <div style={{ display: 'flex', gap: 15, marginTop: 5 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input type="radio" name="editWinner" value="a" checked={editWinner === 'a'} onChange={() => setEditWinner('a')} /> {editTeamA || 'Team A'}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input type="radio" name="editWinner" value="b" checked={editWinner === 'b'} onChange={() => setEditWinner('b')} /> {editTeamB || 'Team B'}
                  </label>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 25, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="cp-secondary-btn" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="cp-primary-btn" onClick={saveEditedMatch}>Save &amp; Recalculate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
