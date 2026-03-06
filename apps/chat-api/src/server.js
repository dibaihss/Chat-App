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
const { authenticateExpress, authenticateSocket } = require("./auth/entraAuth");

const port = Number.parseInt(process.env.CHAT_API_PORT || "3001", 10);
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
const authMode = String(process.env.AUTH_MODE || "entra").toLowerCase();

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

const usersById = new Map();
const usersBySocketId = new Map();

function toClientMessage(record) {
  return {
    id: record.id,
    senderId: record.senderId,
    senderDisplayName: record.senderDisplayName || record.senderId,
    toUserId: record.to || "",
    toDisplayName: record.toDisplayName || "",
    content: record.content,
    type: "CHAT",
    conversationId: record.conversationId,
    createdAt: record.createdAt,
    status: record.status
  };
}

async function ensurePrivateConversation(userAId, userBId) {
  const roomId = buildPrivateConversationId(userAId, userBId);
  await store.ensureRoom({
    roomId,
    createdBy: userAId,
    isPrivate: true,
    name: roomId
  });
  await store.addRoomMember(roomId, userAId, "member");
  await store.addRoomMember(roomId, userBId, "member");
  return roomId;
}

function getUserFromRequest(req) {
  if (authMode === "legacy") {
    const userId = String(req.header("x-user-id") || "").trim();
    if (!userId) {
      return null;
    }
    return {
      oid: userId,
      name: userId
    };
  }
  return req.auth || null;
}

function requireUser(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "Missing authenticated user." });
    return;
  }
  req.user = user;
  next();
}

async function main() {
  await store.init();

  const app = express();
  app.use(cors({ origin: webOrigin }));
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "chat-api", authMode, health: "/health" });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, authMode });
  });

  if (authMode !== "legacy") {
    app.use(authenticateExpress);
  }

  app.get("/users/:userId", requireUser, async (req, res) => {
    const profile = await store.getUserProfile(req.params.userId);
    if (!profile) {
      res.status(404).json({ ok: false, error: "User not found." });
      return;
    }
    res.json({ ok: true, user: profile });
  });

  app.post("/auth/sync-user", requireUser, async (req, res) => {
    try {
      const userId = req.user.oid;
      const displayName = req.user.name || req.user.preferredUsername || userId;
      const user = await store.upsertUserProfile(userId, displayName);
      res.json({ ok: true, user });
    } catch (_error) {
      res.status(500).json({ ok: false, error: "Failed to sync user profile." });
    }
  });

  app.get("/rooms/:roomId/messages", requireUser, async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    const userId = req.user.oid;
    const isMember = await store.isRoomMember(roomId, userId);
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
    const userId = req.user.oid;
    const isMember = await store.isRoomMember(roomId, userId);
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

    const requesterIsMember = await store.isRoomMember(roomId, req.user.oid);
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

  if (authMode !== "legacy") {
    io.use(authenticateSocket);
  }

  const broadcastUsers = () => {
    io.emit(
      "users_online",
      Array.from(usersById.values()).map((u) => ({
        userId: u.userId,
        displayName: u.displayName
      }))
    );
  };

  io.on("connection", (socket) => {
    socket.on("register", async (_rawUsername, ack) => {
      try {
        const auth = authMode === "legacy"
          ? { oid: String(_rawUsername || "").trim(), name: String(_rawUsername || "").trim() }
          : socket.data.auth;
        const userId = String(auth?.oid || "").trim();
        const displayName = String(auth?.name || auth?.preferredUsername || userId).trim();

        if (!userId) {
          ack?.({ ok: false, error: "Authenticated user is required." });
          return;
        }

        await store.upsertUserProfile(userId, displayName);

        usersById.set(userId, { userId, displayName, socketId: socket.id });
        usersBySocketId.set(socket.id, userId);

        ack?.({
          ok: true,
          username: displayName,
          userId,
          displayName
        });

        socket.broadcast.emit("system_message", `${displayName} joined`);
        broadcastUsers();
      } catch (_error) {
        ack?.({ ok: false, error: "Failed to register user." });
      }
    });

    socket.on("open_room", async (payload, ack) => {
      const requesterId = usersBySocketId.get(socket.id);
      if (!requesterId) {
        ack?.({ ok: false, error: "You must register first." });
        return;
      }

      try {
        let roomId = String(payload?.roomId || "").trim();
        if (!roomId) {
          const peerUserId = String(payload?.peerUserId || payload?.peerUser || "").trim();
          if (!peerUserId) {
            ack?.({ ok: false, error: "roomId or peerUserId is required." });
            return;
          }
          roomId = await ensurePrivateConversation(requesterId, peerUserId);
        } else {
          const member = await store.isRoomMember(roomId, requesterId);
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
      } catch (_error) {
        ack?.({ ok: false, error: "Failed to open room." });
      }
    });

    socket.on("private_message", async (payload, ack) => {
      const senderId = usersBySocketId.get(socket.id);
      if (!senderId) {
        ack?.({ ok: false, error: "You must register first." });
        return;
      }

      const toUserId = String(payload?.toUserId || payload?.to || "").trim();
      const content = String(payload?.content || "").trim();
      const idempotencyKey = String(payload?.idempotencyKey || "").trim() || null;

      if (!toUserId || !content) {
        ack?.({ ok: false, error: "Recipient and message are required." });
        return;
      }

      const target = usersById.get(toUserId);
      if (!target?.socketId) {
        ack?.({ ok: false, error: `${toUserId} is offline.` });
        return;
      }

      try {
        const conversationId = await ensurePrivateConversation(senderId, toUserId);
        const senderProfile = usersById.get(senderId);
        const stored = await store.saveMessage({
          conversationId,
          senderId,
          to: toUserId,
          content,
          type: "CHAT",
          status: "sent",
          idempotencyKey
        });
        const message = toClientMessage({
          ...stored,
          senderDisplayName: senderProfile?.displayName || senderId,
          toDisplayName: target.displayName || toUserId
        });

        io.to(target.socketId).emit("private_message", message);
        socket.emit("private_message", message);
        ack?.({ ok: true, message });
      } catch (_error) {
        ack?.({ ok: false, error: "Failed to send message." });
      }
    });

    socket.on("room_message", async (payload, ack) => {
      const senderId = usersBySocketId.get(socket.id);
      if (!senderId) {
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

      const member = await store.isRoomMember(roomId, senderId);
      if (!member) {
        ack?.({ ok: false, error: "You are not a member of this room." });
        return;
      }

      try {
        const senderProfile = usersById.get(senderId);
        const stored = await store.saveMessage({
          conversationId: roomId,
          senderId,
          content,
          type: "CHAT",
          status: "sent",
          idempotencyKey
        });
        const message = toClientMessage({
          ...stored,
          senderDisplayName: senderProfile?.displayName || senderId
        });
        io.to(roomId).emit("room_message", message);
        ack?.({ ok: true, message });
      } catch (_error) {
        ack?.({ ok: false, error: "Failed to send room message." });
      }
    });

    socket.on("disconnect", () => {
      const userId = usersBySocketId.get(socket.id);
      if (!userId) {
        return;
      }

      const user = usersById.get(userId);
      usersBySocketId.delete(socket.id);
      usersById.delete(userId);
      if (user?.displayName) {
        socket.broadcast.emit("system_message", `${user.displayName} left`);
      }
      broadcastUsers();
    });
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Chat API ready on http://localhost:${port} (auth mode: ${authMode})`);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start chat-api:", error);
  process.exit(1);
});
