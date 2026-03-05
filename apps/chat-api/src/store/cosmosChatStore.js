const { CosmosClient } = require("@azure/cosmos");
const crypto = require("crypto");
const { buildMembershipId } = require("../../../../packages/shared/src/chatTypes");

function parseIntOrDefault(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

class CosmosChatStore {
  constructor(config) {
    const endpointInput = String(config.endpoint || "").trim();
    const keyInput = String(config.key || "").trim();
    const connectionStringInput = String(config.connectionString || "").trim();

    let endpoint = endpointInput;
    let key = keyInput;

    // Accept full Cosmos connection string in either COSMOS_CONNECTION_STRING or COSMOS_ENDPOINT.
    const candidateConnectionString =
      connectionStringInput || (endpointInput.includes("AccountEndpoint=") ? endpointInput : "");
    if (candidateConnectionString) {
      const endpointMatch = candidateConnectionString.match(/AccountEndpoint=([^;]+);?/i);
      const keyMatch = candidateConnectionString.match(/AccountKey=([^;]+);?/i);
      endpoint = endpointMatch ? endpointMatch[1].trim() : "";
      key = keyMatch ? keyMatch[1].trim() : "";
    }

    if (!endpoint || !key) {
      throw new Error(
        "Cosmos config missing. Set COSMOS_CONNECTION_STRING or COSMOS_ENDPOINT + COSMOS_KEY."
      );
    }

    this.databaseId = config.databaseId || "chat_app";
    this.containerIds = {
      messages: config.messagesContainerId || "messages",
      users: config.usersContainerId || "users",
      rooms: config.roomsContainerId || "rooms",
      memberships: config.membershipsContainerId || "room_memberships"
    };

    this.client = new CosmosClient({
      endpoint,
      key,
      consistencyLevel: "Session"
    });
  }

  // async init() {
  //   const { database } = await this.client.databases.createIfNotExists({ id: this.databaseId });
  //   this.database = database;

  //   const ttl = parseIntOrDefault(process.env.COSMOS_EPHEMERAL_TTL_SECONDS, null);

  //   const { container: messages } = await database.containers.createIfNotExists({
  //     id: this.containerIds.messages,
  //     partitionKey: { paths: ["/conversationId"] },
  //     indexingPolicy: {
  //       indexingMode: "consistent",
  //       includedPaths: [{ path: "/*" }]
  //     }
  //   });

  //   const { container: users } = await database.containers.createIfNotExists({
  //     id: this.containerIds.users,
  //     partitionKey: { paths: ["/userId"] }
  //   });

  //   const { container: rooms } = await database.containers.createIfNotExists({
  //     id: this.containerIds.rooms,
  //     partitionKey: { paths: ["/roomId"] }
  //   });

  //   const { container: memberships } = await database.containers.createIfNotExists({
  //     id: this.containerIds.memberships,
  //     partitionKey: { paths: ["/roomId"] }
  //   });

  //   this.containers = { messages, users, rooms, memberships };
  //   this.ephemeralTtl = ttl;
  // }

  async upsertUserProfile(userId) {
    const now = new Date().toISOString();
    const doc = {
      id: userId,
      userId,
      displayName: userId,
      avatar: "",
      createdAt: now,
      lastSeenAt: now
    };

    try {
      const existing = await this.containers.users.item(userId, userId).read();
      if (existing.resource) {
        doc.createdAt = existing.resource.createdAt || now;
        doc.avatar = existing.resource.avatar || "";
      }
    } catch (error) {
      if (error.code !== 404) {
        throw error;
      }
    }

    await this.containers.users.items.upsert(doc);
    return doc;
  }

  async getUserProfile(userId) {
    try {
      const response = await this.containers.users.item(userId, userId).read();
      return response.resource || null;
    } catch (error) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async ensureRoom({ roomId, createdBy, isPrivate = false, name = "" }) {
    const now = new Date().toISOString();
    const doc = {
      id: roomId,
      roomId,
      name: name || roomId,
      createdBy,
      createdAt: now,
      isPrivate: Boolean(isPrivate)
    };

    try {
      const response = await this.containers.rooms.item(roomId, roomId).read();
      if (response.resource) {
        return response.resource;
      }
    } catch (error) {
      if (error.code !== 404) {
        throw error;
      }
    }

    await this.containers.rooms.items.upsert(doc);
    return doc;
  }

  async addRoomMember(roomId, userId, role = "member") {
    const membershipId = buildMembershipId(roomId, userId);
    const doc = {
      id: membershipId,
      roomId,
      userId,
      role,
      joinedAt: new Date().toISOString()
    };

    try {
      const response = await this.containers.memberships.item(membershipId, roomId).read();
      if (response.resource) {
        return response.resource;
      }
    } catch (error) {
      if (error.code !== 404) {
        throw error;
      }
    }

    await this.containers.memberships.items.upsert(doc);
    return doc;
  }

  async getRoomMembers(roomId) {
    const query = {
      query: "SELECT c.id, c.roomId, c.userId, c.role, c.joinedAt FROM c WHERE c.roomId = @roomId",
      parameters: [{ name: "@roomId", value: roomId }]
    };
    const { resources } = await this.containers.memberships.items
      .query(query, { partitionKey: roomId })
      .fetchAll();
    return resources;
  }

  async isRoomMember(roomId, userId) {
    const membershipId = buildMembershipId(roomId, userId);
    try {
      const response = await this.containers.memberships.item(membershipId, roomId).read();
      return Boolean(response.resource);
    } catch (error) {
      if (error.code === 404) {
        return false;
      }
      throw error;
    }
  }

  async saveMessage({
    conversationId,
    senderId,
    content,
    type = "CHAT",
    status = "sent",
    to = null,
    idempotencyKey = null
  }) {
    const createdAt = new Date().toISOString();
    const id = idempotencyKey ? `${conversationId}:${idempotencyKey}` : crypto.randomUUID();
    const doc = {
      id,
      conversationId,
      senderId,
      to,
      content,
      type,
      createdAt,
      editedAt: null,
      status
    };

    try {
      const response = await this.containers.messages.items.create(doc);
      return response.resource;
    } catch (error) {
      if (error.code !== 409 || !idempotencyKey) {
        throw error;
      }
      const existing = await this.containers.messages.item(id, conversationId).read();
      return existing.resource;
    }
  }

  async listMessages(conversationId, limit = 50, continuation = null) {
    const query = {
      query:
        "SELECT c.id, c.conversationId, c.senderId, c.to, c.content, c.type, c.createdAt, c.editedAt, c.status " +
        "FROM c WHERE c.conversationId = @conversationId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@conversationId", value: conversationId }]
    };

    const iterator = this.containers.messages.items.query(query, {
      partitionKey: conversationId,
      maxItemCount: limit,
      continuationToken: continuation || undefined
    });

    const page = await iterator.fetchNext();
    return {
      items: (page.resources || []).reverse(),
      continuation: page.continuationToken || null
    };
  }
}

module.exports = { CosmosChatStore };
