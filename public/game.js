// ----- Socket.IO connection -----
const socket = io();

let roomId = null;
let currentState = null; // { players: { id: { hp } }, playerOrder: [id1,id2], turn, lastAction }
let myId = null;
let playerOrder = null; // cached ordered player ids from server

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
  playerOrder = currentState.playerOrder;

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
  // keep playerOrder if present (should always be there after fix)
  if (state.playerOrder) playerOrder = state.playerOrder;
  updateUI();
});

// Update the HP display + whose turn
function updateUI() {
  if (!currentState || !myId || !playerOrder) return;

  const players = currentState.players;
  const p1Id = playerOrder[0];
  const p2Id = playerOrder[1];
  const p1Hp = players[p1Id]?.hp ?? 0;
  const p2Hp = players[p2Id]?.hp ?? 0;

  // Update fixed slots (Player 1 / Player 2 consistent across both clients)
  const p1HpSpan = document.querySelector("#player-1 .hp");
  const p2HpSpan = document.querySelector("#player-2 .hp");
  if (p1HpSpan) p1HpSpan.textContent = p1Hp;
  if (p2HpSpan) p2HpSpan.textContent = p2Hp;

  // Turn indicator shows "You" if it's your socket's turn, else the other
  const isMyTurn = currentState.turn === myId;
  currentPlayerEl.textContent = isMyTurn ? "You" : "Opponent";
  endTurnButton.disabled = !isMyTurn;

  console.log(`HP Update: P1(${p1Id})=${p1Hp}, P2(${p2Id})=${p2Hp}, MyId=${myId}, TurnHolder=${currentState.turn}`);
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
