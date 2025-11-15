const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // example test event
  socket.emit("server-message", "Connected to Word Wizards server!");

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
