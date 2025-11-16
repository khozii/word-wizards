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
      [p1Id]: { hp: 100 },
      [p2Id]: { hp: 100 }
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
    const game = games.get(roomId);
    if (!game) return;

    const { state, players } = game;

    // Only the current player can end their turn
    if (state.turn !== socket.id) return;

    // test: deal 10 damage to opponent.
    const opponentId = players.find((id) => id !== socket.id);
    state.players[opponentId].hp = Math.max(
      0,
      state.players[opponentId].hp - (action.damage || 10)
    );
    state.lastAction = { from: socket.id, action };

    // switch turn
    state.turn = opponentId;

    // If someone is dead, maybe mark game over here

    // Broadcast updated state to both players in the room
    io.to(roomId).emit("state-update", state);
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
