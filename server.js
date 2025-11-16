const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

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
  if (waitingPlayers.length > 0) {
    const opponent = waitingPlayers.shift();

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
    waitingPlayers.push(socket);
    socket.emit("waiting-for-opponent");
  }
}

// Socket.IO handlers 

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("find-match", () => {
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
          // Deal damage to opponent
          opponent.hp = Math.max(0, opponent.hp - action.damage);
          console.log(`${socket.id} cast ${action.spellName} for ${action.damage} damage, opponent HP: ${opponent.hp}`);
        } else if (action.spellType === 'heal') {
          // Heal current player
          currentPlayer.hp = Math.min(100, currentPlayer.hp + action.damage);
          console.log(`${socket.id} cast ${action.spellName} for ${action.damage} healing, HP: ${currentPlayer.hp}`);
        }
        
        // Check for game over
        if (opponent.hp <= 0) {
          state.gameOver = true;
          state.winner = socket.id;
          console.log(`Game over! Player ${socket.id} wins!`);
        }
      } else {
        console.log(`${socket.id} tried to cast ${action.spellName} but had insufficient mana (${currentPlayer.mana}/${action.mana})`);
      }
      
      // Record the action
      state.lastAction = { from: socket.id, action };
      
      // Send update but DON'T end turn (player can cast more spells)
      io.to(roomId).emit("state-update", state);
      
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
