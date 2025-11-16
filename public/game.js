// ----- Socket.IO connection -----
const socket = io();

let roomId = null;
let currentState = null; // { players: { id: { hp } }, turn, lastAction }
let myId = null;
let myPlayerIndex = null; // 0 => player1, 1 => player2
let prevIsMyTurn = null;

// DOM refs
const startScreen = document.getElementById("start-screen");
const gameContainer = document.getElementById("game-container");
const startButton = document.getElementById("start-button");
const statusEl = document.getElementById("status");
const currentPlayerEl = document.getElementById("current-player");
const endTurnButton = document.getElementById("end-turn-button");
const youAreEl = document.getElementById('you-are');

// Player HP spans in the UI
const p1HpEl = document.querySelector("#player-1 .hp");
const p2HpEl = document.querySelector("#player-2 .hp");
const p1AvatarEl = document.getElementById('player-1-avatar');
const p2AvatarEl = document.getElementById('player-2-avatar');
const overlayEl = document.getElementById('turn-overlay');
const overlayImgEl = document.getElementById('turn-overlay-img');

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

  // change page background for the match (place `walmart.jpg` in `public/images`)
  try {
    document.body.style.backgroundImage = "url('images/walmart.jpg')";
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  } catch (e) {
    console.warn('Could not set walmart background:', e);
  }

  // Initialize UI from state
  // determine which player slot this client is (based on keys order)
  const playerKeys = Object.keys(currentState.players);
  myPlayerIndex = playerKeys.indexOf(myId);

  // set avatar srcs (fixed mapping)
  if (p1AvatarEl) p1AvatarEl.src = 'images/Player1.png';
  if (p2AvatarEl) p2AvatarEl.src = 'images/Player2.png';

  // Keep both avatars visible in their respective panels
  if (p1AvatarEl) p1AvatarEl.style.display = '';
  if (p2AvatarEl) p2AvatarEl.style.display = '';

  // show the opponent avatar persistently in the center overlay
  if (overlayEl && overlayImgEl && myPlayerIndex !== null) {
    const opponentIndex = myPlayerIndex === 0 ? 1 : 0;
    const filename = `images/Player${opponentIndex + 1}.png`;
    overlayImgEl.src = filename;
    overlayImgEl.alt = `Player ${opponentIndex + 1}`;
    overlayEl.style.display = 'flex';
    overlayEl.style.opacity = '1';
    overlayEl.setAttribute('aria-hidden', 'false');
  }

  // show which player this client is
  if (youAreEl && myPlayerIndex !== null) {
    youAreEl.textContent = `You are: Player ${myPlayerIndex + 1}`;
    youAreEl.style.display = 'inline-block';
  }

  // highlight player panels based on who the client is
  if (myPlayerIndex === 0) {
    // client is Player 1
    document.getElementById('player-1')?.classList.add('you-are');
    document.getElementById('player-2')?.classList.add('opponent');
  } else if (myPlayerIndex === 1) {
    // client is Player 2
    document.getElementById('player-2')?.classList.add('you-are');
    document.getElementById('player-1')?.classList.add('opponent');
  }

  // initialize prevIsMyTurn so overlay will flash on first update
  prevIsMyTurn = null;

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

  // flash overlay when turn changes (show opponent avatar)
  if (prevIsMyTurn === null || isMyTurn !== prevIsMyTurn) {
    flashTurnOverlay(isMyTurn);
    prevIsMyTurn = isMyTurn;
  }
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

<<<<<<< HEAD
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
=======
// show the opponent avatar in the center briefly when turn changes
function flashTurnOverlay(isMyTurn) {
  if (!overlayEl || !overlayImgEl || myPlayerIndex === null) return;

  // opponent index
  const opponentIndex = myPlayerIndex === 0 ? 1 : 0;
  const filename = `images/Player${opponentIndex + 1}.png`;
  overlayImgEl.src = filename;
  overlayImgEl.alt = `Player ${opponentIndex + 1}`;

  // ensure the overlay stays visible and shows the opponent image
  overlayEl.style.display = 'flex';
  overlayEl.style.opacity = '1';
  overlayEl.setAttribute('aria-hidden', 'false');
  // update the image in case opponent changed (no auto-hide)
  // (we already set overlayImgEl.src above)
}
>>>>>>> d96d4a1ffff8ce8d183ab7c8a48d65a8ecc06bce
