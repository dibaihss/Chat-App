export function buildConversations(messages, usersOnline, currentUserId, searchTerm) {
  const ownChats = messages.filter(
    (msg) =>
      msg.type === "CHAT" &&
      (msg.senderId === currentUserId || msg.toUserId === currentUserId)
  );
  const byUser = new Map();

  ownChats.forEach((msg) => {
    const otherUserId = msg.senderId === currentUserId ? msg.toUserId : msg.senderId;
    const otherDisplayName =
      msg.senderId === currentUserId ? (msg.toDisplayName || otherUserId) : msg.senderDisplayName;
    if (!otherUserId) {
      return;
    }

    const existing = byUser.get(otherUserId);
    if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) {
      byUser.set(otherUserId, {
        userId: otherUserId,
        displayName: otherDisplayName || otherUserId,
        lastMessage: msg.content,
        createdAt: msg.createdAt
      });
    }
  });

  usersOnline
    .filter((user) => user.userId !== currentUserId)
    .forEach((user) => {
      if (!byUser.has(user.userId)) {
        byUser.set(user.userId, {
          userId: user.userId,
          displayName: user.displayName || user.userId,
          lastMessage: "No messages yet",
          createdAt: new Date(0).toISOString()
        });
      }
    });

  return Array.from(byUser.values())
    .filter((entry) => entry.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function buildActiveThread(messages, activeRoomId) {
  if (!activeRoomId) {
    return [];
  }

  return messages.filter((msg) => {
    if (msg.type === "SYSTEM") {
      return true;
    }

    return msg.type === "CHAT" && msg.conversationId === activeRoomId;
  });
}

export function getConnectingText(errorText, statusText) {
  return errorText || statusText;
}
