function toIsoNow() {
  return new Date().toISOString();
}

function buildPrivateConversationId(userA, userB) {
  return [String(userA || "").trim(), String(userB || "").trim()].sort().join(":");
}

function buildMembershipId(roomId, userId) {
  return `${roomId}:${userId}`;
}

module.exports = {
  toIsoNow,
  buildPrivateConversationId,
  buildMembershipId
};
