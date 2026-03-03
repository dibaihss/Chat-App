export function buildConversations(messages, usersOnline, username, searchTerm) {
  const ownChats = messages.filter(
    (msg) => msg.type === "CHAT" && (msg.sender === username || msg.to === username)
  );
  const byUser = new Map();

  ownChats.forEach((msg) => {
    const otherUser = msg.sender === username ? msg.to : msg.sender;
    const existing = byUser.get(otherUser);
    if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) {
      byUser.set(otherUser, { user: otherUser, lastMessage: msg.content, createdAt: msg.createdAt });
    }
  });

  usersOnline
    .filter((user) => user !== username)
    .forEach((user) => {
      if (!byUser.has(user)) {
        byUser.set(user, {
          user,
          lastMessage: "No messages yet",
          createdAt: new Date(0).toISOString()
        });
      }
    });

  return Array.from(byUser.values())
    .filter((entry) => entry.user.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function buildActiveThread(messages, activeChat, username) {
  if (!activeChat) {
    return [];
  }

  return messages.filter((msg) => {
    if (msg.type === "SYSTEM") {
      return true;
    }

    return (
      msg.type === "CHAT" &&
      ((msg.sender === username && msg.to === activeChat) ||
        (msg.sender === activeChat && msg.to === username))
    );
  });
}

export function getConnectingText(errorText, statusText) {
  return errorText || statusText;
}
