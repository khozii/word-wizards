import path from "path";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { 
  COUNTER_TIME_LIMIT, 
  processCounterSpell, 
  counterSpellEffectivness 
} from "./public/gamelogic.js";

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// In-memory matchmaking + game state

// sockets waiting for a match
const waitingPlayers = [];

// games: roomId -> { players: [socketIdP1, socketIdP2], state: { ... } }
const games = new Map();

function createInitialState(p1Id, p2Id) {
  return {
    players: {
      [p1Id]: { hp: 100, mana: 50, shield: 0 },
      [p2Id]: { hp: 100, mana: 50, shield: 0 }
    },
    // Fixed player order so both clients render consistent Player 1 / Player 2
    playerOrder: [p1Id, p2Id],
    turn: p1Id,   // whose turn it is (socket.id)
    lastAction: null
  };
}

// Pair players into a room when possible
function matchmake(socket) {
  console.log(`Matchmaking for ${socket.id}, waiting players: ${waitingPlayers.length}`);
  
  if (waitingPlayers.length > 0) {
    const opponent = waitingPlayers.shift();
    console.log(`Pairing ${socket.id} with ${opponent.id}`);

    // create room
    const roomId = `room-${socket.id}-${opponent.id}`;
    socket.join(roomId);
    opponent.join(roomId);

    const initialState = createInitialState(socket.id, opponent.id);
    games.set(roomId, {
      roomId,
      players: [socket.id, opponent.id],
      state: initialState
    });

    // Tell both players match is ready
    io.to(roomId).emit("match-found", {
      roomId,
      state: initialState
    });

    console.log(`Created game ${roomId}`);
  } else {
    console.log(`Adding ${socket.id} to waiting list`);
    waitingPlayers.push(socket);
    socket.emit("waiting-for-opponent");
  }
}

// Socket.IO handlers 

// Process counter phase and apply damage
function processCounterPhase(roomId, counterAttempt, spellData) {
  const game = games.get(roomId);
  if (!game) {
    console.log(`Game not found for counter processing: ${roomId}`);
    return;
  }
  
  const { state, players } = game;
  
  // Prevent double processing
  if (state.counterProcessed) {
    console.log(`Counter already processed for room ${roomId}`);
    return;
  }
  state.counterProcessed = true;
  
  const defender = state.players[spellData.defenderId];
  const attacker = state.players[spellData.attackerId];
  
  if (!defender || !attacker) {
    console.log(`Player data not found for counter processing`);
    return;
  }
  
  // Create mock defender object for gamelogic
  const mockDefender = {
    health: defender.hp,
    shield: 0 // Assuming no shield system in current game
  };
  
  // Use the correct gamelogic function to process counter spell
  const counterResult = processCounterSpell(mockDefender, spellData.spell, counterAttempt);
  
  console.log(`Counter result: ${counterResult.correctChars}/${counterResult.spellLength} chars correct, ${counterResult.damageReductionPercent}% reduction`);
  
  // Apply the calculated health from gamelogic
  defender.hp = Math.max(0, mockDefender.health);
  console.log(`${spellData.defenderId} took ${counterResult.finalDamage} damage after counter, HP: ${defender.hp}`);
  
  // Check for game over
  if (defender.hp <= 0) {
    state.gameOver = true;
    state.winner = spellData.attackerId;
    console.log(`Game over! Player ${spellData.attackerId} wins!`);
  }
  
  // Record the action
  state.lastAction = { 
    from: spellData.attackerId, 
    action: { 
      type: 'spell-cast', 
      spellName: spellData.spell.name,
      damage: counterResult.finalDamage,
      spellType: spellData.spell.type
    }
  };
  
  // Send counter phase end with results
  const endResult = {
    ...counterResult,
    attackerId: spellData.attackerId,
    defenderId: spellData.defenderId,
    spellName: spellData.spell.name,
    counterAttempt: counterAttempt
  };
  
  io.to(roomId).emit("counter-phase-end", endResult);
  
  // Send updated game state
  io.to(roomId).emit("state-update", state);
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("find-match", () => {
    console.log(`Received find-match from ${socket.id}`);
    matchmake(socket);
  });

  socket.on("end-turn", ({ roomId, action }) => {
    console.log(`Received action from ${socket.id}:`, action);
    
    const game = games.get(roomId);
    if (!game) {
      console.log(`Game not found for room ${roomId}`);
      return;
    }

    const { state, players } = game;

    // Only the current player can act
    if (state.turn !== socket.id) {
      console.log(`${socket.id} tried to act but it's ${state.turn}'s turn`);
      return;
    }

    const currentPlayer = state.players[socket.id];
    const opponentId = players.find((id) => id !== socket.id);
    const opponent = state.players[opponentId];

    if (!currentPlayer || !opponent) {
      console.log(`Player data not found`);
      return;
    }

    // Handle different action types
    if (action.type === 'spell-cast') {
      console.log(`Processing spell cast: ${action.spellName} (${action.mana} mana, ${action.damage} damage)`);
      
      // Check if player has enough mana
      if (currentPlayer.mana >= action.mana) {
        // Consume mana
        currentPlayer.mana -= action.mana;
        console.log(`${socket.id} consumed ${action.mana} mana, remaining: ${currentPlayer.mana}`);
        
        // Apply spell effect
        if (action.spellType === 'attack') {
          // For attack spells, start counter phase instead of applying damage immediately
          const opponentId = players.find((id) => id !== socket.id);
          
          console.log(`Starting counter phase for attack spell: ${action.spellName}`);
          
          // Start counter phase
          const counterData = {
            attackerId: socket.id,
            defenderId: opponentId,
            spell: {
              name: action.spellName,
              damage: action.damage,
              type: action.spellType
            },
            roomId: roomId
          };
          
          // Send counter phase start to both players
          io.to(roomId).emit("counter-phase-start", counterData);
          
          // Mark that we're waiting for counter - don't process until client submits
          state.counterProcessed = false;
          
        } else if (action.spellType === 'heal') {
          // Heal spells don't trigger counter phase
          currentPlayer.hp = Math.min(100, currentPlayer.hp + action.damage);
          console.log(`${socket.id} cast ${action.spellName} for ${action.damage} healing, HP: ${currentPlayer.hp}`);
          
          // Record the action and send update immediately for heal spells
          state.lastAction = { from: socket.id, action };
          io.to(roomId).emit("state-update", state);
        }
        
      } else {
        console.log(`${socket.id} tried to cast ${action.spellName} but had insufficient mana (${currentPlayer.mana}/${action.mana})`);
        
        // Send update for insufficient mana
        state.lastAction = { from: socket.id, action };
        io.to(roomId).emit("state-update", state);
      }
      
    } else if (action.type === 'spell-failed') {
      console.log(`Processing failed spell: ${action.spellName}`);
      
      // Still consume mana as penalty for failed cast
      if (currentPlayer.mana >= action.mana) {
        currentPlayer.mana -= action.mana;
        console.log(`${socket.id} failed to cast ${action.spellName}, consumed ${action.mana} mana as penalty`);
      }
      
      // Record the action
      state.lastAction = { from: socket.id, action };
      
      // Send update but DON'T end turn
      io.to(roomId).emit("state-update", state);
      
    } else if (action.type === 'end-turn') {
      // Player explicitly ended their turn
      console.log(`${socket.id} ended their turn`);
      
      // Switch turns and regenerate mana
      state.turn = opponentId;
      
      // Regenerate mana for the player whose turn is starting (cap at 50)
      const nextPlayer = state.players[opponentId];
      nextPlayer.mana = Math.min(50, nextPlayer.mana + 15);
      console.log(`${opponentId} starts turn with ${nextPlayer.mana} mana`);
      
      // Record the action
      state.lastAction = { from: socket.id, action };
      
      // Send update with new turn
      io.to(roomId).emit("state-update", state);
    }
  });

  // Handle counter attempts
  socket.on("counter-attempt", ({ roomId, counterAttempt, spellData }) => {
    console.log(`Counter attempt from ${socket.id}: "${counterAttempt}"`);
    
    const game = games.get(roomId);
    if (!game) {
      console.log(`Game not found for counter attempt: ${roomId}`);
      return;
    }
    
    // Verify this is the defender
    if (spellData.defenderId !== socket.id) {
      console.log(`Invalid counter attempt: ${socket.id} is not the defender`);
      return;
    }
    
    // Process the counter with user's attempt (submitted after timer)
    console.log('Processing user counter attempt:', counterAttempt);
    processCounterPhase(roomId, counterAttempt, spellData);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Remove from waiting queue if present
    const idx = waitingPlayers.findIndex((s) => s.id === socket.id);
    if (idx !== -1) {
      waitingPlayers.splice(idx, 1);
    }

    // TODO: clean up any games this socket was in, inform opponent, etc.
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
