// ----- Socket.IO connection -----
const socket = io();

let roomId = null;
let currentState = null; // { players: { id: { hp } }, turn, lastAction }
let myId = null;

// DOM refs
const startScreen = document.getElementById("start-screen");
const gameContainer = document.getElementById("game-container");
const startButton = document.getElementById("start-button");
const statusEl = document.getElementById("status");
const currentPlayerEl = document.getElementById("current-player");
const endTurnButton = document.getElementById("end-turn-button");

// Player HP spans in the UI
const p1HpEl = document.querySelector("#player-1 .hp");
const p2HpEl = document.querySelector("#player-2 .hp");

// When connected to Socket.IO
socket.on("connect", () => {
  myId = socket.id;
  console.log("Connected as", myId);
  if (statusEl) statusEl.textContent = "Connected (not in match)";
});

socket.on("disconnect", () => {
  console.log("Disconnected");
  if (statusEl) statusEl.textContent = "Disconnected";
});

// Click "Start Game" to find an online opponent
startButton.addEventListener("click", () => {
  socket.emit("find-match");
  if (statusEl) statusEl.textContent = "Searching for an opponent...";
  startButton.disabled = true;
});

// Server says you're in queue
socket.on("waiting-for-opponent", () => {
  if (statusEl) statusEl.textContent = "Waiting for another player...";
});

// Server found a match
socket.on("match-found", (payload) => {
  roomId = payload.roomId;
  currentState = payload.state;

  console.log("Match found:", roomId, currentState);
  if (statusEl) statusEl.textContent = `Match found! Room: ${roomId}`;

  // Hide start UI, show game UI
  startScreen.style.display = "none";
  gameContainer.style.display = "block";

  // Initialize UI from state
  updateUI();
});

// Server sends updated state after a turn
socket.on("state-update", (state) => {
  currentState = state;
  updateUI();
});

// Update the HP display + whose turn
function updateUI() {
  if (!currentState || !myId) return;

  const players = currentState.players;

  const myHp = players[myId]?.hp ?? 0;
  const opponentId = Object.keys(players).find((id) => id !== myId);
  const opponentHp = players[opponentId]?.hp ?? 0;

  // For now, treat Player 1 as "you", Player 2 as "opponent" in the UI.
  p1HpEl.textContent = myHp;
  p2HpEl.textContent = opponentHp;

  const isMyTurn = currentState.turn === myId;
  currentPlayerEl.textContent = isMyTurn ? "You" : "Opponent";
  endTurnButton.disabled = !isMyTurn;
}

// CHANGED: Show typing textbox when a player clicks "Cast Spell" so they can see what they type.
// - Creates an input positioned on the left side under the active player
// - Styled to match the game theme (purple/teal gradient, rounded corners)
// - Submits on Enter (emits `end-turn` with action)
// - Only available when it's the local player's turn
function showTypingInput() {
  // If an input already exists, focus it
  let wrap = document.getElementById('typing-input-wrap');
  if (wrap) {
    const existing = document.getElementById('typing-input');
    if (existing) existing.focus();
    return;
  }

  wrap = document.createElement('div');
  wrap.id = 'typing-input-wrap';
  wrap.className = 'typing-input-container';

  const label = document.createElement('label');
  label.textContent = 'Cast spell:';
  label.className = 'typing-label';
  
  const input = document.createElement('input');
  input.id = 'typing-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.placeholder = 'Type spell name...';
  input.className = 'typing-input-field';

  // Submit on Enter, cancel on Escape
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      submitTypedSpell(input.value.trim());
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      wrap.remove();
    }
  });

  label.appendChild(input);
  wrap.appendChild(label);
  document.body.appendChild(wrap);
  input.focus();
}

function submitTypedSpell(spellName) {
  const wrap = document.getElementById('typing-input-wrap');
  if (!currentState || !roomId || currentState.turn !== myId) {
    if (wrap) wrap.remove();
    return;
  }

  if (!spellName) {
    // don't send empty actions; just remove input
    if (wrap) wrap.remove();
    return;
  }

  // For now, emit the same `end-turn` action payload used elsewhere.
  const action = {
    spellName: spellName,
    damage: 10
  };

  socket.emit('end-turn', { roomId, action });

  // remove input after submit
  if (wrap) wrap.remove();
}

// Handle End Turn: send action to server
endTurnButton.addEventListener("click", () => {
  if (!roomId || !currentState || currentState.turn !== myId) return;

  // TODO: REPLACE this with your real typing-based calculation
  const action = {
    spellName: "Placeholder Spell",
    damage: 10,
    // timeMs: ...
  };

  socket.emit("end-turn", { roomId, action });
});

// CHANGED: Show typing input when player clicks the Cast Spell button in the UI
document.getElementById('players')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const panel = btn.closest('.player');
  if (!panel) return;
  const action = btn.dataset.action;
  if (action === 'spell') {
    // only allow when it's our turn
    if (!currentState || currentState.turn !== myId) return;
    showTypingInput();
  }
});
