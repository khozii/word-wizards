import { foodSpells } from './wwfoodspell.js';
import { 
  ATTACK_TIME_LIMIT, 
  COUNTER_TIME_LIMIT, 
  attemptCastSpell,
  castPlayerSpell,
  MANA_REGEN_PER_TURN,
  MANA_CAP,
  counterSpellEffectivness,
  processCounterSpell
} from './gamelogic.js';

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
let isInCounterPhase = false; // tracks if we're in a counter phase
let counterSpellData = null; // stores data for the current counter phase

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
const gameOverScreen = document.getElementById('game-over-screen');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverDetail = document.getElementById('game-over-detail');
const returnToMenuButton = document.getElementById('return-to-menu-button');

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
  console.log("Start button clicked, sending find-match");
  socket.emit("find-match");
  if (statusEl) statusEl.textContent = "Searching for an opponent...";
  startButton.disabled = true;
});

// Wire up Choose Spell buttons
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('selection-btn') && e.target.dataset.action === 'choose') {
    showSpellMenu();
  }
  
  // Handle Cast Spell button
  if (e.target.classList.contains('action-btn') && e.target.dataset.action === 'spell') {
    if (!currentState || currentState.turn !== myId) {
      console.log('Not your turn!');
      return;
    }
    if (!selectedSpell) {
      alert('Please choose a spell first!');
      return;
    }
    showTypingInput();
  }
});

// Server says you're in queue
socket.on("waiting-for-opponent", () => {
  console.log("Received waiting-for-opponent event");
  if (statusEl) statusEl.textContent = "Waiting for another player...";
});

// Server found a match
socket.on("match-found", (payload) => {
  console.log("Received match-found event with payload:", payload);
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

// Counter phase events
socket.on("counter-phase-start", (data) => {
  console.log('=== COUNTER PHASE START ===');
  console.log('Counter phase started:', data);
  console.log('My ID:', myId);
  console.log('Defender ID:', data.defenderId);
  console.log('Am I defender?', data.defenderId === myId);
  
  isInCounterPhase = true;
  counterSpellData = data;
  
  if (data.defenderId === myId) {
    console.log('Showing counter input for defender');
    // I am the defender - show counter input
    showCounterInput(data.spell);
  } else {
    console.log('Showing attacker waiting screen');
    // I am the attacker - show waiting message
    showAttackerWaiting(data.spell);
  }
});

socket.on("counter-phase-end", (result) => {
  console.log('Counter phase ended:', result);
  isInCounterPhase = false;
  counterSpellData = null;
  
  // Hide any counter UI
  hideCounterUI();
  
  // Show counter result message
  showCounterResult(result);
});

// Track previous state for mana regeneration detection
let previousState = null;

// Server sends updated state after a turn
socket.on("state-update", (state) => {
  console.log('State update received:', state);
  
  // Check for mana regeneration - only when it becomes MY turn
  if (previousState && currentState && myId) {
    const wasMyTurn = currentState.turn === myId;
    const isNowMyTurn = state.turn === myId;
    const prevMana = currentState.players?.[myId]?.mana ?? 50;
    const newMana = state.players?.[myId]?.mana ?? 50;
    
    console.log(`Turn check: wasMyTurn=${wasMyTurn}, isNowMyTurn=${isNowMyTurn}`);
    console.log(`Mana check: prevMana=${prevMana}, newMana=${newMana}, myId=${myId}`);
    
    // Only check for mana regen when it becomes my turn (not when I'm ending my turn)
    if (!wasMyTurn && isNowMyTurn && newMana > prevMana) {
      const manaGained = newMana - prevMana;
      console.log(`Mana regenerated: +${manaGained}`);
      showManaRegenMessage(manaGained);
    }
  } else {
    console.log('Mana regen check skipped:', {
      previousState: !!previousState,
      currentState: !!currentState,
      myId: !!myId
    });
  }
  
  previousState = currentState;
  currentState = state;
  // keep playerOrder if present (should always be there after fix)
  if (state.playerOrder) playerOrder = state.playerOrder;
  updateUI();
});

// Game over event
socket.on('game-over', ({ winnerId, state }) => {
  currentState = state;
  console.log('Game over received. Winner:', winnerId);
  showGameOver(winnerId);
});

// Update the HP display + whose turn
function updateUI() {
  if (!currentState || !myId || !playerOrder) return;
  if (currentState.gameOver) return; // game-over handler manages end state UI

  const players = currentState.players;
  const p1Id = playerOrder[0];
  const p2Id = playerOrder[1];
  const p1Hp = players[p1Id]?.hp ?? 0;
  const p2Hp = players[p2Id]?.hp ?? 0;

  // Update fixed slots (Player 1 / Player 2 consistent across both clients)
  const p1HpSpan = document.querySelector("#player-1 .hp");
  const p2HpSpan = document.querySelector("#player-2 .hp");
  const p1ManaSpan = document.querySelector("#player-1 .mana");
  const p2ManaSpan = document.querySelector("#player-2 .mana");
  
  if (p1HpSpan) p1HpSpan.textContent = p1Hp;
  if (p2HpSpan) p2HpSpan.textContent = p2Hp;
  
  const p1Mana = players[p1Id]?.mana ?? 50;
  const p2Mana = players[p2Id]?.mana ?? 50;
  if (p1ManaSpan) p1ManaSpan.textContent = p1Mana;
  if (p2ManaSpan) p2ManaSpan.textContent = p2Mana;

  const isMyTurn = currentState.turn === myId;
  currentPlayerEl.textContent = isMyTurn ? "You" : "Opponent";
  endTurnButton.disabled = !isMyTurn;

  // Enable/disable player buttons based on turn and player identity
  updatePlayerButtons(isMyTurn);

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

  // End turn without casting a spell
  const action = {
    type: 'end-turn',
    spellName: null,
    damage: 0
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

// Enable/disable player buttons based on turn and player identity
function updatePlayerButtons(isMyTurn) {
  if (myPlayerIndex === null) return;

  // Get all buttons in both player panels
  const p1Buttons = document.querySelectorAll('#player-1 .selection-btn, #player-1 .action-btn');
  const p2Buttons = document.querySelectorAll('#player-2 .selection-btn, #player-2 .action-btn');

  if (myPlayerIndex === 0) {
    // I am Player 1
    // Enable my buttons only on my turn, disable opponent buttons always
    p1Buttons.forEach(btn => btn.disabled = !isMyTurn);
    p2Buttons.forEach(btn => btn.disabled = true);
  } else if (myPlayerIndex === 1) {
    // I am Player 2
    // Enable my buttons only on my turn, disable opponent buttons always
    p2Buttons.forEach(btn => btn.disabled = !isMyTurn);
    p1Buttons.forEach(btn => btn.disabled = true);
  }
}

// Display win/lose screen
function showGameOver(winnerId) {
  // Disable all interactive buttons
  document.querySelectorAll('button').forEach(b => b.disabled = true);

  const iWon = winnerId === myId;
  if (gameOverTitle) {
    gameOverTitle.textContent = iWon ? 'You Win!' : 'You Lose!';
  }
  if (gameOverDetail) {
    const p1Id = playerOrder ? playerOrder[0] : 'P1';
    const p2Id = playerOrder ? playerOrder[1] : 'P2';
    const myLabel = (myPlayerIndex === 0) ? 'Player 1' : 'Player 2';
    const winnerLabel = (winnerId === p1Id) ? 'Player 1' : 'Player 2';
    gameOverDetail.textContent = iWon
      ? `Well played ${myLabel}! You reduced your opponent to 0 HP.`
      : `Better luck next time ${myLabel}. ${winnerLabel} won this duel.`;
  }

  if (gameOverScreen) gameOverScreen.style.display = 'flex';

  if (returnToMenuButton) {
    returnToMenuButton.disabled = false;
    returnToMenuButton.addEventListener('click', () => {
      // Return to start screen
      gameOverScreen.style.display = 'none';
      gameContainer.style.display = 'none';
      startScreen.style.display = 'block';
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      
      // Reset game state
      roomId = null;
      currentState = null;
      myPlayerIndex = null;
      playerOrder = null;
      selectedSpell = null;
      prevIsMyTurn = null;
      
      // Re-enable start button
      startButton.disabled = false;
      
      // Reset status
      if (statusEl) statusEl.textContent = "Connected (not in match)";
    }, { once: true });
  }
}

// Show spell selection menu
function showSpellMenu() {
  // Only allow during player's turn
  if (!currentState || currentState.turn !== myId) return;
  
  // Don't allow spell casting during counter phase
  if (isInCounterPhase) {
    console.log('Cannot cast spells during counter phase!');
    return;
  }

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
    updateSpellQueue();
    console.log('Selected spell:', spell.name);
  });
  
  return button;
}

// Update spell queue display
function updateSpellQueue() {
  const queueEl = document.getElementById('spell-queue');
  const nameEl = document.getElementById('queued-spell-name');
  const statsEl = document.getElementById('queued-spell-stats');
  
  if (!queueEl || !nameEl || !statsEl) return;
  
  if (selectedSpell) {
    queueEl.style.display = 'block';
    nameEl.textContent = selectedSpell.name;
    const damageOrHeal = selectedSpell.type === 'attack' ? 'Damage' : 'Heal';
    statsEl.textContent = `${damageOrHeal}: ${selectedSpell.damage} | Mana: ${selectedSpell.mana} | Click "Cast Spell" to launch it!`;
  } else {
    queueEl.style.display = 'none';
    nameEl.textContent = 'None';
    statsEl.textContent = 'Click "Cast Spell" to launch it!';
  }
}

// Show typing input for spell casting
function showTypingInput() {
  // Remove existing input if present
  const existing = document.getElementById('typing-input-container');
  if (existing) existing.remove();
  
  // Create typing container
  const container = document.createElement('div');
  container.id = 'typing-input-container';
  container.className = 'typing-input-container';
  
  const label = document.createElement('label');
  label.textContent = `Type "${selectedSpell.name}" to cast:`;
  label.className = 'typing-label';
  
  const input = document.createElement('input');
  input.id = 'typing-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.placeholder = 'Type the spell name exactly...';
  input.className = 'typing-input-field';
  
  // Timer display
  const timer = document.createElement('div');
  timer.id = 'typing-timer';
  timer.className = 'typing-timer';
  const timerSeconds = Math.floor(ATTACK_TIME_LIMIT / 1000);
  timer.textContent = timerSeconds;
  
  // Only cancel on Escape (no Enter key casting)
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      container.remove();
      // Clear selected spell when cancelled
      selectedSpell = null;
      updateSpellQueue();
    }
  });
  
  container.appendChild(label);
  container.appendChild(input);
  container.appendChild(timer);
  document.body.appendChild(container);
  input.focus();
  
  // Start countdown based on ATTACK_TIME_LIMIT
  let timeLeft = Math.floor(ATTACK_TIME_LIMIT / 1000);
  const countdown = setInterval(() => {
    timeLeft--;
    timer.textContent = timeLeft;
    
    if (timeLeft <= 0) {
      clearInterval(countdown);
      const currentInput = document.getElementById('typing-input');
      const currentValue = currentInput ? currentInput.value.trim() : '';
      container.remove();
      
      // Always cast spell when timer ends (even if empty)
      submitTypedSpell(currentValue);
    }
  }, 1000);
  
  // Store countdown so we can clear it if spell is cast
  container._countdown = countdown;
}

// Submit typed spell and validate
function submitTypedSpell(typedName) {
  console.log('submitTypedSpell called with:', typedName);
  console.log('selectedSpell:', selectedSpell);
  console.log('currentState:', currentState);
  console.log('roomId:', roomId);
  console.log('myId:', myId);
  
  // Clean up input container if it still exists
  const container = document.getElementById('typing-input-container');
  if (container) {
    // Clear countdown
    const countdown = container._countdown;
    if (countdown) clearInterval(countdown);
    
    // Remove input
    container.remove();
    console.log('Cleaned up typing input container');
  } else {
    console.log('Typing input container already removed (timer expired)');
  }
  
  if (!currentState || !roomId || currentState.turn !== myId || !selectedSpell) {
    console.log('Invalid spell cast attempt - missing required data:');
    console.log('  currentState:', !!currentState);
    console.log('  roomId:', !!roomId);
    console.log('  turn check:', currentState?.turn === myId);
    console.log('  selectedSpell:', !!selectedSpell);
    return;
  }
  
  // Create mock player object for gamelogic validation (server has real state)
  const mockPlayer = {
    mana: 50, // Server will validate actual mana
    health: 100,
    shield: 0
  };
  
  console.log('Attempting to cast spell with:');
  console.log('  mockPlayer:', mockPlayer);
  console.log('  selectedSpell:', selectedSpell);
  console.log('  typedName:', typedName);
  
  // Use gamelogic function to validate spell cast
  const castResult = attemptCastSpell(mockPlayer, selectedSpell, typedName);
  console.log('Cast result:', castResult);
  
  if (castResult.success) {
    console.log('Spell cast successfully!', selectedSpell.name);
    
    // Create action payload for successful cast
    const action = {
      type: 'spell-cast',
      spellName: selectedSpell.name,
      damage: selectedSpell.damage,
      spellType: selectedSpell.type,
      mana: selectedSpell.mana,
      typedName: typedName
    };
    
    // Send to server (server will handle actual mana consumption using gamelogic)
    socket.emit('end-turn', { roomId, action });
    
  } else {
    console.log(`Spell failed! Reason: ${castResult.reason}`);
    
    // Create action payload for failed cast
    const failedAction = {
      type: 'spell-failed',
      spellName: selectedSpell.name,
      mana: selectedSpell.mana,
      typedName: typedName,
      reason: castResult.reason
    };
    
    // Send failed action to server (server will handle mana consumption)
    socket.emit('end-turn', { roomId, action: failedAction });
  }
  
  // Clear selected spell and update queue regardless of result
  selectedSpell = null;
  updateSpellQueue();
  
  // Don't end turn - player can continue casting more spells
  console.log('Spell cast complete. You can cast another spell or click "End Turn".');
}

// Show mana regeneration message for 1 second
function showManaRegenMessage(manaGained) {
  console.log('showManaRegenMessage called with:', manaGained);
  
  const messageEl = document.getElementById('mana-regen-message');
  console.log('Message element found:', !!messageEl);
  
  if (!messageEl) {
    console.error('Mana regen message element not found!');
    return;
  }
  
  messageEl.textContent = `+${manaGained} Mana Regenerated!`;
  
  // Reset animation by removing and re-adding the animation style
  messageEl.style.animation = 'none';
  messageEl.style.display = 'block';
  
  // Force reflow and then add animation
  messageEl.offsetHeight; 
  messageEl.style.animation = 'manaRegenPulse 1s ease-in-out';
  
  console.log('Mana regen message displayed with animation');
  
  // Hide after 1 second
  setTimeout(() => {
    messageEl.style.display = 'none';
    messageEl.style.animation = 'none';
    console.log('Mana regen message hidden');
  }, 1000);
}

// Show counter input for defender
function showCounterInput(spell) {
  console.log('Showing counter input for spell:', spell);
  
  const container = document.createElement('div');
  container.id = 'counter-input-container';
  container.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 0, 0, 0.9);
    color: white;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    z-index: 3000;
    border: 3px solid #ff0000;
    box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
  `;
  
  const title = document.createElement('h3');
  title.textContent = 'INCOMING SPELL!';
  title.style.cssText = 'margin: 0 0 10px 0; color: #ffff00; font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.7);';
  
  const spellName = document.createElement('div');
  spellName.textContent = `"${spell.name}"`;
  spellName.style.cssText = 'font-size: 20px; font-weight: bold; margin: 10px 0; color: #ff8888;';
  
  const instruction = document.createElement('div');
  instruction.textContent = 'Type the spell name to reduce damage!';
  instruction.style.cssText = 'margin: 10px 0; font-size: 16px;';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'counter-input';
  input.placeholder = 'Type spell name...';
  input.style.cssText = `
    width: 200px;
    padding: 8px;
    font-size: 16px;
    border: 2px solid #fff;
    border-radius: 4px;
    text-align: center;
    margin: 10px 0;
  `;
  
  const timer = document.createElement('div');
  timer.id = 'counter-timer';
  timer.style.cssText = `
    font-size: 28px;
    font-weight: bold;
    color: #ffff00;
    margin: 10px 0;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
  `;
  
  container.appendChild(title);
  container.appendChild(spellName);
  container.appendChild(instruction);
  container.appendChild(input);
  container.appendChild(timer);
  document.body.appendChild(container);
  
  input.focus();
  
  // Start countdown
  let timeLeft = Math.floor(COUNTER_TIME_LIMIT / 1000);
  timer.textContent = timeLeft;
  
  const countdown = setInterval(() => {
    timeLeft--;
    timer.textContent = timeLeft;
    
    if (timeLeft <= 0) {
      clearInterval(countdown);
      const typedAttempt = input.value.trim();
      submitCounterAttempt(typedAttempt);
    }
  }, 1000);
  
  // Store countdown for cleanup
  container._countdown = countdown;
}

// Show waiting message for attacker
function showAttackerWaiting(spell) {
  console.log('Showing attacker waiting for spell:', spell);
  
  const container = document.createElement('div');
  container.id = 'attacker-waiting-container';
  container.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 255, 0.9);
    color: white;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    z-index: 3000;
    border: 3px solid #0000ff;
    box-shadow: 0 0 20px rgba(0, 0, 255, 0.5);
  `;
  
  const title = document.createElement('h3');
  title.textContent = 'Spell Cast!';
  title.style.cssText = 'margin: 0 0 10px 0; color: #ffff00; font-size: 24px;';
  
  const spellName = document.createElement('div');
  spellName.textContent = `"${spell.name}"`;
  spellName.style.cssText = 'font-size: 20px; font-weight: bold; margin: 10px 0; color: #8888ff;';
  
  const waiting = document.createElement('div');
  waiting.textContent = 'Opponent is countering...';
  waiting.style.cssText = 'margin: 10px 0; font-size: 16px; font-style: italic;';
  
  const timer = document.createElement('div');
  timer.id = 'attacker-timer';
  timer.style.cssText = `
    font-size: 28px;
    font-weight: bold;
    color: #ffff00;
    margin: 10px 0;
  `;
  
  container.appendChild(title);
  container.appendChild(spellName);
  container.appendChild(waiting);
  container.appendChild(timer);
  document.body.appendChild(container);
  
  // Start countdown
  let timeLeft = Math.floor(COUNTER_TIME_LIMIT / 1000);
  timer.textContent = timeLeft;
  
  const countdown = setInterval(() => {
    timeLeft--;
    timer.textContent = timeLeft;
    
    if (timeLeft <= 0) {
      clearInterval(countdown);
    }
  }, 1000);
  
  container._countdown = countdown;
}

// Submit counter attempt to server
function submitCounterAttempt(counterAttempt) {
  console.log('Submitting counter attempt:', counterAttempt);
  
  if (!counterSpellData || !roomId) {
    console.error('No counter data available');
    return;
  }
  
  socket.emit('counter-attempt', {
    roomId: roomId,
    counterAttempt: counterAttempt,
    spellData: counterSpellData
  });
}

// Hide all counter UI
function hideCounterUI() {
  const counterContainer = document.getElementById('counter-input-container');
  const attackerContainer = document.getElementById('attacker-waiting-container');
  
  if (counterContainer) {
    const countdown = counterContainer._countdown;
    if (countdown) clearInterval(countdown);
    counterContainer.remove();
  }
  
  if (attackerContainer) {
    const countdown = attackerContainer._countdown;
    if (countdown) clearInterval(countdown);
    attackerContainer.remove();
  }
}

// Show counter result message
function showCounterResult(result) {
  console.log('Showing counter result:', result);
  
  const messageEl = document.getElementById('mana-regen-message'); // Reuse existing message element
  if (!messageEl) return;
  
  const damageReduction = Math.round(result.damageReductionPercent || 0);
  const finalDamage = Math.round(result.finalDamage || 0);
  
  let message;
  if (result.defenderId === myId) {
    // I was defending
    if (damageReduction > 0) {
      message = `Counter: ${damageReduction}% damage blocked! Took ${finalDamage} damage.`;
    } else {
      message = `Counter failed! Took full ${finalDamage} damage.`;
    }
  } else {
    // I was attacking
    if (damageReduction > 0) {
      message = `Opponent countered ${damageReduction}%! Dealt ${finalDamage} damage.`;
    } else {
      message = `Counter failed! Dealt full ${finalDamage} damage.`;
    }
  }
  
  messageEl.textContent = message;
  messageEl.style.background = damageReduction > 0 ? 'linear-gradient(135deg, #ff9800, #f57c00)' : 'linear-gradient(135deg, #f44336, #d32f2f)';
  messageEl.style.animation = 'none';
  messageEl.style.display = 'block';
  
  // Force reflow and add animation
  messageEl.offsetHeight;
  messageEl.style.animation = 'manaRegenPulse 1s ease-in-out';
  
  // Hide after 2 seconds (longer for counter results)
  setTimeout(() => {
    messageEl.style.display = 'none';
    messageEl.style.animation = 'none';
    messageEl.style.background = 'linear-gradient(135deg, #4CAF50, #8BC34A)'; // Reset to mana regen colors
  }, 2000);
}

}); // End DOMContentLoaded
