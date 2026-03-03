const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const port = parseInt(process.env.PORT || "3000", 10);
const isProd = process.argv.includes("--prod") || process.env.NODE_ENV === "production";
const app = next({ dev: !isProd });
const handle = app.getRequestHandler();

const usersByName = new Map();
const usersBySocketId = new Map();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  const broadcastUsers = () => {
    io.emit("users_online", Array.from(usersByName.keys()));
  };

  io.on("connection", (socket) => {
    socket.on("register", (rawUsername, ack) => {
      const username = String(rawUsername || "").trim();
      if (!username) {
        ack?.({ ok: false, error: "Username is required." });
        return;
      }
      if (usersByName.has(username)) {
        ack?.({ ok: false, error: "Username is already in use." });
        return;
      }

      usersByName.set(username, socket.id);
      usersBySocketId.set(socket.id, username);
      ack?.({ ok: true, username });

      socket.broadcast.emit("system_message", `${username} joined`);
      broadcastUsers();
    });

    socket.on("private_message", (payload, ack) => {
      const sender = usersBySocketId.get(socket.id);
      if (!sender) {
        ack?.({ ok: false, error: "You must register first." });
        return;
      }

      const to = String(payload?.to || "").trim();
      const content = String(payload?.content || "").trim();

      if (!to || !content) {
        ack?.({ ok: false, error: "Recipient and message are required." });
        return;
      }

      const targetSocketId = usersByName.get(to);
      if (!targetSocketId) {
        ack?.({ ok: false, error: `${to} is offline.` });
        return;
      }

      const message = {
        sender,
        to,
        content,
        createdAt: new Date().toISOString()
      };

      io.to(targetSocketId).emit("private_message", message);
      socket.emit("private_message", message);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const username = usersBySocketId.get(socket.id);
      if (!username) {
        return;
      }

      usersBySocketId.delete(socket.id);
      usersByName.delete(username);
      socket.broadcast.emit("system_message", `${username} left`);
      broadcastUsers();
    });
  });

  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server ready on http://localhost:${port}`);
  });
});
