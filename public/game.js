const statusEl = document.getElementById("status");
const messagesEl = document.getElementById("messages");

// Connect to Socket.IO server
const socket = io();

socket.on("connect", () => {
  statusEl.textContent = `Connected (id: ${socket.id})`;
});

socket.on("disconnect", () => {
  statusEl.textContent = "Disconnected";
});

socket.on("server-message", (msg) => {
  const li = document.createElement("li");
  li.textContent = msg;
  messagesEl.appendChild(li);
});
