import { foodSpells } from './wwfoodspell.js';

// Wait for DOM to be ready before accessing elements
document.addEventListener('DOMContentLoaded', () => {

// ----- Socket.IO connection -----
const socket = window.io();

let roomId = null;
let currentState = null; // { players: { id: { hp } }, playerOrder: [id1,id2], turn, lastAction }
let myId = null;
let myPlayerIndex = null; // 0 => player1, 1 => player2
let prevIsMyTurn = null;
let playerOrder = null; // cached ordered player ids from server
let selectedSpell = null; // tracks the spell chosen from the menu

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

// Wire up Choose Spell buttons
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('selection-btn') && e.target.dataset.action === 'choose') {
    showSpellMenu();
  }
});

// Server says you're in queue
socket.on("waiting-for-opponent", () => {
  if (statusEl) statusEl.textContent = "Waiting for another player...";
});

// Server found a match
socket.on("match-found", (payload) => {
  roomId = payload.roomId;
  currentState = payload.state;
  playerOrder = currentState.playerOrder; // store ordered player IDs

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

  const isMyTurn = currentState.turn === myId;
  currentPlayerEl.textContent = isMyTurn ? "You" : "Opponent";
  endTurnButton.disabled = !isMyTurn;

  console.log(`HP Update: P1(${p1Id})=${p1Hp}, P2(${p2Id})=${p2Hp}, MyId=${myId}, TurnHolder=${currentState.turn}`);

  // flash overlay when turn changes (show opponent avatar)
  if (prevIsMyTurn === null || isMyTurn !== prevIsMyTurn) {
    flashTurnOverlay(isMyTurn);
    prevIsMyTurn = isMyTurn;
  }
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

// Show spell selection menu
function showSpellMenu() {
  // Only allow during player's turn
  if (!currentState || currentState.turn !== myId) return;

  // Remove existing menu if present
  const existing = document.getElementById('spell-menu');
  if (existing) existing.remove();

  // Create menu container
  const menu = document.createElement('div');
  menu.id = 'spell-menu';
  menu.className = 'spell-menu-container';

  // Menu header
  const header = document.createElement('h3');
  header.className = 'spell-menu-header';
  header.textContent = 'Choose Your Spell';
  menu.appendChild(header);

  // Group spells by type
  const attackSpells = [];
  const healSpells = [];
  
  Object.values(foodSpells).forEach(spell => {
    if (spell.type === 'attack') {
      attackSpells.push(spell);
    } else if (spell.type === 'heal') {
      healSpells.push(spell);
    }
  });

  // Attack section
  if (attackSpells.length > 0) {
    const attackSection = document.createElement('div');
    attackSection.className = 'spell-section';
    
    const attackHeader = document.createElement('h4');
    attackHeader.className = 'spell-section-header';
    attackHeader.textContent = 'Attack Spells';
    attackSection.appendChild(attackHeader);
    
    attackSpells.forEach(spell => {
      attackSection.appendChild(createSpellButton(spell));
    });
    
    menu.appendChild(attackSection);
  }

  // Heal section
  if (healSpells.length > 0) {
    const healSection = document.createElement('div');
    healSection.className = 'spell-section';
    
    const healHeader = document.createElement('h4');
    healHeader.className = 'spell-section-header';
    healHeader.textContent = 'Heal Spells';
    healSection.appendChild(healHeader);
    
    healSpells.forEach(spell => {
      healSection.appendChild(createSpellButton(spell));
    });
    
    menu.appendChild(healSection);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'spell-menu-close';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => menu.remove());
  menu.appendChild(closeBtn);

  document.body.appendChild(menu);
}

// Create individual spell button
function createSpellButton(spell) {
  const button = document.createElement('button');
  button.className = 'spell-item';
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'spell-name';
  nameDiv.textContent = spell.name;
  
  const statsDiv = document.createElement('div');
  statsDiv.className = 'spell-stats';
  const damageOrHeal = spell.type === 'attack' ? 'Damage' : 'Heal';
  statsDiv.textContent = `${damageOrHeal}: ${spell.damage} | Mana: ${spell.mana}`;
  
  button.appendChild(nameDiv);
  button.appendChild(statsDiv);
  
  button.addEventListener('click', () => {
    selectedSpell = spell;
    document.getElementById('spell-menu').remove();
    console.log('Selected spell:', spell.name);
  });
  
  return button;
}

}); // End DOMContentLoaded
