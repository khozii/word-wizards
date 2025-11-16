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
