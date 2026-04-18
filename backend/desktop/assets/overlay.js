import {
  db,
  isFirebaseConfigured,
  limitToLast,
  onValue,
  query,
  roomActiveMatchRef,
  matchMetaRef,
  matchPredictionsRef,
  matchChatRef,
  removeChatMessage,
  removePrediction
} from "./firebase.js";
import { initWindowLogger } from "./logger.js";
import {
  getAudienceEntryUrl,
  escapeHtml,
  getRoomId,
  setHidden,
  sortByTimestampDescending,
  applyTeamTheme,
  getTeamLogoPath,
  stripKlipyUrl
} from "./shared.js";

initWindowLogger("Overlay");

const params = new URLSearchParams(window.location.search);
const isDesktopMode = params.get("mode") === "desktop";
const roomId = getRoomId();
const overlayWidget = document.querySelector("#overlayWidget");
const audienceUrlLabel = document.querySelector("#audienceUrlLabel");
const audienceCodeLabel = document.querySelector("#audienceCodeLabel");
const joinCopyButton = document.querySelector("#joinCopyButton");
const predictionCards = document.querySelector("#predictionCards");
const overlayChatFeed = document.querySelector("#overlayChatFeed");
const predictionCount = document.querySelector("#predictionCount");
const setupNotice = document.querySelector("#overlaySetupNotice");
const teamALabel = document.querySelector("#teamALabel");
const teamBLabel = document.querySelector("#teamBLabel");
const graphPercent = document.querySelector("#graphPercent");
const graphFill = document.querySelector("#graphFill");
const winProbOverlay = document.querySelector("#winProbOverlay");

let activeMatchId = null;
let currentPredictions = [];
let currentMeta = {};
let matchUnsubscribers = [];

document.body.classList.toggle("desktop-embed", isDesktopMode);
audienceUrlLabel.textContent = getAudienceEntryUrl().replace(/^https?:\/\//, "");
audienceCodeLabel.textContent = `Code: ${roomId.toUpperCase()}`;

const clearMatchSubscriptions = () => {
  matchUnsubscribers.forEach(unsub => unsub());
  matchUnsubscribers = [];
};

const setupMatchListeners = (matchId) => {
  clearMatchSubscriptions();
  if (!matchId) {
    console.log("[Overlay] No active match ID provided");
    return;
  }
  
  console.log("[Overlay] Subscribing to match:", matchId);
  
  // 1. Match Predictions
  const unsubPreds = onValue(matchPredictionsRef(matchId), (snapshot) => {
    const entries = snapshot.val() || {};
    currentPredictions = Object.entries(entries).map(([id, value]) => ({
      clientId: id,
      ...value
    }));
    renderPredictions(currentPredictions);
    updateGraph();
  });
  matchUnsubscribers.push(unsubPreds);

  // 2. Match Meta
  const unsubMeta = onValue(matchMetaRef(matchId), (snapshot) => {
    currentMeta = snapshot.val() || {};
    document.body.classList.toggle("chat-hidden", !!currentMeta.hideChat);
    document.body.classList.toggle("join-hidden", !!currentMeta.hideJoin);
    applyTeamTheme(currentMeta.teamA, currentMeta.teamB);
    updateGraph();
    updateWinProb();
    if (currentPredictions.length > 0) renderPredictions(currentPredictions);
  });
  matchUnsubscribers.push(unsubMeta);

  // 3. Match Chat
  const unsubChat = onValue(query(matchChatRef(matchId), limitToLast(10)), (snapshot) => {
    const entries = snapshot.val() || {};
    const messages = Object.entries(entries).map(([id, value]) => ({ id, ...value }));
    renderChat(messages);
  });
  matchUnsubscribers.push(unsubChat);
};

// --- SUBSCRIPTION TO ACTIVE MATCH ---
if (isFirebaseConfigured && db) {
  onValue(roomActiveMatchRef(roomId), (snapshot) => {
    const newMatchId = snapshot.val();
    if (newMatchId !== activeMatchId) {
      activeMatchId = newMatchId;
      setupMatchListeners(activeMatchId);
    }
  });
} else {
  setHidden(setupNotice, false);
}

// (Rest of the rendering functions remain essentially the same but using activeMatchId for admin actions)
// ... [I will collapse them for brevity in this scratch script but ensure they are in the final file]

const renderPredictions = (predictions) => {
   // [KEEP ORIGINAL LOGIC]
   const sorted = [...predictions].sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
   const recent = sorted.slice(0, 15);
   predictionCount.textContent = `${predictions.length} live`;
   if (!recent.length) {
     predictionCards.innerHTML = `<div class="empty-state overlay-empty">Waiting for predictions...</div>`;
     return;
   }
   predictionCards.innerHTML = recent.map(p => `
     <article class="prediction-card compact single-line">
       <span class="prediction-name">${escapeHtml(p.name)}</span>
       <div class="prediction-val">${escapeHtml(p.prediction || p.predictedScore || "")}</div>
     </article>
   `).join("");
};

const renderChat = (messages) => {
  const recent = sortByTimestampDescending(messages, "createdAt").slice(0, 5);
  overlayChatFeed.innerHTML = recent.map(m => `
    <article class="overlay-message">
       <strong>${escapeHtml(m.name)}</strong>: ${escapeHtml(stripKlipyUrl(m.message))}
    </article>
  `).join("");
};

const updateGraph = () => { /* ... */ };
const updateWinProb = () => { /* ... */ };

const handleOverlayAdminClick = async (event) => {
  const button = event.target.closest(".overlay-admin-remove");
  if (!button || !activeMatchId) return;
  const { removeType, removeId } = button.dataset;
  try {
    if (removeType === "prediction") await removePrediction(activeMatchId, removeId);
    else if (removeType === "chat") await removeChatMessage(activeMatchId, removeId);
  } catch (e) { alert(e.message); }
};
