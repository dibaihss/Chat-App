const http = require("http");
const path = require("path");
require("dotenv").config({
  path: process.env.CHAT_API_ENV_FILE || path.resolve(__dirname, "../.env")
});
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { CosmosChatStore } = require("./store/cosmosChatStore");
const { buildPrivateConversationId } = require("../../../packages/shared/src/chatTypes");

const port = Number.parseInt(process.env.CHAT_API_PORT || "3001", 10);
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";

const store = new CosmosChatStore({
  connectionString: process.env.COSMOS_CONNECTION_STRING,
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
  databaseId: process.env.COSMOS_DATABASE_ID || "chat_app",
  messagesContainerId: process.env.COSMOS_MESSAGES_CONTAINER_ID || "messages",
  usersContainerId: process.env.COSMOS_USERS_CONTAINER_ID || "users",
  roomsContainerId: process.env.COSMOS_ROOMS_CONTAINER_ID || "rooms",
  membershipsContainerId: process.env.COSMOS_MEMBERSHIPS_CONTAINER_ID || "room_memberships"
});

const usersByName = new Map();
const usersBySocketId = new Map();

function toClientMessage(record) {
  return {
    id: record.id,
    sender: record.senderId,
    to: record.to || "",
    content: record.content,
    type: "CHAT",
    conversationId: record.conversationId,
    createdAt: record.createdAt,
    status: record.status
  };
}

async function ensurePrivateConversation(userA, userB) {
  const roomId = buildPrivateConversationId(userA, userB);
  await store.ensureRoom({
    roomId,
    createdBy: userA,
    isPrivate: true,
    name: roomId
  });
  await store.addRoomMember(roomId, userA, "member");
  await store.addRoomMember(roomId, userB, "member");
  return roomId;
}

function requireUser(req, res, next) {
  const userId = String(req.header("x-user-id") || "").trim();
  if (!userId) {
    res.status(401).json({ ok: false, error: "Missing x-user-id header." });
    return;
  }

  req.userId = userId;
  next();
}

async function main() {
  // await store.init();

  const app = express();
  app.use(cors({ origin: webOrigin }));
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "chat-api", health: "/health" });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/users/:userId", requireUser, async (req, res) => {
    const profile = await store.getUserProfile(req.params.userId);
    if (!profile) {
      res.status(404).json({ ok: false, error: "User not found." });
      return;
    }
    res.json({ ok: true, user: profile });
  });

  app.get("/rooms/:roomId/messages", requireUser, async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    const isMember = await store.isRoomMember(roomId, req.userId);
    if (!isMember) {
      res.status(403).json({ ok: false, error: "You are not a member of this room." });
      return;
    }

    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "50"), 10), 1), 100);
    const continuation = String(req.query.continuation || "").trim() || null;
    const result = await store.listMessages(roomId, limit, continuation);
    res.json({ ok: true, messages: result.items.map(toClientMessage), continuation: result.continuation });
  });

  app.get("/rooms/:roomId/members", requireUser, async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    const isMember = await store.isRoomMember(roomId, req.userId);
    if (!isMember) {
      res.status(403).json({ ok: false, error: "You are not a member of this room." });
      return;
    }
    const members = await store.getRoomMembers(roomId);
    res.json({ ok: true, members });
  });

  app.post("/rooms/:roomId/members", requireUser, async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    const targetUserId = String(req.body?.userId || "").trim();
    const role = String(req.body?.role || "member").trim() || "member";

    if (!targetUserId) {
      res.status(400).json({ ok: false, error: "userId is required." });
      return;
    }

    const requesterIsMember = await store.isRoomMember(roomId, req.userId);
    if (!requesterIsMember) {
      res.status(403).json({ ok: false, error: "You are not a member of this room." });
      return;
    }

    await store.addRoomMember(roomId, targetUserId, role);
    res.status(201).json({ ok: true });
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: webOrigin }
  });

  const broadcastUsers = () => {
    io.emit("users_online", Array.from(usersByName.keys()));
  };

  io.on("connection", (socket) => {
    socket.on("register", async (rawUsername, ack) => {
      try {
        const username = String(rawUsername || "").trim();
        if (!username) {
          ack?.({ ok: false, error: "Username is required." });
          return;
        }

        if (usersByName.has(username)) {
          ack?.({ ok: false, error: "Username is already in use." });
          return;
        }

        await store.upsertUserProfile(username);
        usersByName.set(username, socket.id);
        usersBySocketId.set(socket.id, username);

        ack?.({ ok: true, username });
        socket.broadcast.emit("system_message", `${username} joined`);
        broadcastUsers();
      } catch (error) {
        ack?.({ ok: false, error: "Failed to register user." });
      }
    });

    socket.on("open_room", async (payload, ack) => {
      const requester = usersBySocketId.get(socket.id);
      if (!requester) {
        ack?.({ ok: false, error: "You must register first." });
        return;
      }

      try {
        let roomId = String(payload?.roomId || "").trim();
        if (!roomId) {
          const peerUser = String(payload?.peerUser || "").trim();
          if (!peerUser) {
            ack?.({ ok: false, error: "roomId or peerUser is required." });
            return;
          }
          roomId = await ensurePrivateConversation(requester, peerUser);
        } else {
          const member = await store.isRoomMember(roomId, requester);
          if (!member) {
            ack?.({ ok: false, error: "You are not a member of this room." });
            return;
          }
        }

        socket.join(roomId);
        const history = await store.listMessages(roomId, 50, null);
        ack?.({
          ok: true,
          roomId,
          messages: history.items.map(toClientMessage),
          continuation: history.continuation
        });
      } catch (error) {
        ack?.({ ok: false, error: "Failed to open room." });
      }
    });

    socket.on("private_message", async (payload, ack) => {
      const sender = usersBySocketId.get(socket.id);
      if (!sender) {
        ack?.({ ok: false, error: "You must register first." });
        return;
      }

      const to = String(payload?.to || "").trim();
      const content = String(payload?.content || "").trim();
      const idempotencyKey = String(payload?.idempotencyKey || "").trim() || null;

      if (!to || !content) {
        ack?.({ ok: false, error: "Recipient and message are required." });
        return;
      }

      const targetSocketId = usersByName.get(to);
      if (!targetSocketId) {
        ack?.({ ok: false, error: `${to} is offline.` });
        return;
      }

      try {
        const conversationId = await ensurePrivateConversation(sender, to);
        const stored = await store.saveMessage({
          conversationId,
          senderId: sender,
          to,
          content,
          type: "CHAT",
          status: "sent",
          idempotencyKey
        });
        const message = toClientMessage(stored);

        io.to(targetSocketId).emit("private_message", message);
        socket.emit("private_message", message);
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, error: "Failed to send message." });
      }
    });

    socket.on("room_message", async (payload, ack) => {
      const sender = usersBySocketId.get(socket.id);
      if (!sender) {
        ack?.({ ok: false, error: "You must register first." });
        return;
      }

      const roomId = String(payload?.roomId || "").trim();
      const content = String(payload?.content || "").trim();
      const idempotencyKey = String(payload?.idempotencyKey || "").trim() || null;
      if (!roomId || !content) {
        ack?.({ ok: false, error: "roomId and content are required." });
        return;
      }

      const member = await store.isRoomMember(roomId, sender);
      if (!member) {
        ack?.({ ok: false, error: "You are not a member of this room." });
        return;
      }

      try {
        const stored = await store.saveMessage({
          conversationId: roomId,
          senderId: sender,
          content,
          type: "CHAT",
          status: "sent",
          idempotencyKey
        });
        const message = toClientMessage(stored);
        io.to(roomId).emit("room_message", message);
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, error: "Failed to send room message." });
      }
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

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Chat API ready on http://localhost:${port}`);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start chat-api:", error);
  process.exit(1);
});
