export default function ConversationList({
  searchTerm,
  onSearchTermChange,
  conversations,
  activeChat,
  onOpenConversation,
  unreadByUser,
  getAvatarColor,
  formatTime
}) {
  return (
    <aside className="middle-sidebar">
      <div className="search-wrap">
        <input
          type="text"
          className="search-input"
          placeholder="Search chats"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      </div>
      <ul className="chat-list">
        {conversations.map((entry) => (
          <li key={entry.user}>
            <button
              type="button"
              className={`chat-list-item${activeChat === entry.user ? " selected" : ""}`}
              onClick={() => onOpenConversation(entry.user)}
            >
              <div className="avatar small" style={{ backgroundColor: getAvatarColor(entry.user) }}>
                {entry.user[0]}
              </div>
              <div className="chat-meta">
                <div className="chat-meta-top">
                  <span className="chat-name">{entry.user}</span>
                  <span className="chat-time">
                    {entry.lastMessage === "No messages yet" ? "--" : formatTime(entry.createdAt)}
                  </span>
                </div>
                <div className="chat-meta-bottom">
                  <span className="chat-preview">{entry.lastMessage}</span>
                  {unreadByUser[entry.user] > 0 && (
                    <span className="unread-badge">{unreadByUser[entry.user]}</span>
                  )}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
