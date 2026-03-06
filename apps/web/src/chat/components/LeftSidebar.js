export default function LeftSidebar({
  username,
  activeNav,
  onActiveNavChange,
  getAvatarColor,
  onSignOut
}) {
  return (
    <aside className="left-sidebar">
      <div className="app-logo">RT</div>
      <nav className="nav-icons">
        <button
          type="button"
          className={`nav-icon-btn${activeNav === "chat" ? " active" : ""}`}
          onClick={() => onActiveNavChange("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={`nav-icon-btn${activeNav === "groups" ? " active" : ""}`}
          onClick={() => onActiveNavChange("groups")}
        >
          Teams
        </button>
        <button
          type="button"
          className={`nav-icon-btn${activeNav === "calls" ? " active" : ""}`}
          onClick={() => onActiveNavChange("calls")}
        >
          Calls
        </button>
        <button
          type="button"
          className={`nav-icon-btn${activeNav === "settings" ? " active" : ""}`}
          onClick={() => onActiveNavChange("settings")}
        >
          Settings
        </button>
      </nav>
      <div className="profile-card">
        <div className="avatar" style={{ backgroundColor: getAvatarColor(username) }}>
          {username[0]}
        </div>
        <div>
          <div className="profile-name">{username}</div>
          <div className="profile-status">Online</div>
        </div>
      </div>
      <button type="button" className="nav-icon-btn" onClick={onSignOut}>
        Sign out
      </button>
    </aside>
  );
}
