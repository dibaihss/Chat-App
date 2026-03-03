import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const colors = [
  "#2196F3",
  "#32c787",
  "#00BCD4",
  "#ff5652",
  "#ffc107",
  "#ff85af",
  "#FF9800",
  "#39bbb0"
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = 31 * hash + name.charCodeAt(i);
  }
  return colors[Math.abs(hash % colors.length)];
}

function formatTime(isoDate) {
  return new Date(isoDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const [usernameInput, setUsernameInput] = useState("");
  const [username, setUsername] = useState("");
  const [activeNav, setActiveNav] = useState("chat");
  const [activeChat, setActiveChat] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [usersOnline, setUsersOnline] = useState([]);
  const [unreadByUser, setUnreadByUser] = useState({});
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");

  const socketRef = useRef(null);
  const messageAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const usernameRef = useRef("");
  const activeChatRef = useRef("");

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    const socket = io({ autoConnect: false });
    socketRef.current = socket;

    socket.on("private_message", (message) => {
      setMessages((prev) => [...prev, { ...message, type: "CHAT" }]);
      if (
        message.sender !== usernameRef.current &&
        message.sender !== activeChatRef.current
      ) {
        setUnreadByUser((prev) => ({ ...prev, [message.sender]: (prev[message.sender] || 0) + 1 }));
      }
    });

    socket.on("system_message", (content) => {
      setMessages((prev) => [
        ...prev,
        { sender: "system", content, type: "SYSTEM", createdAt: new Date().toISOString() }
      ]);
    });

    socket.on("users_online", (users) => {
      setUsersOnline(users);
    });

    socket.on("connect_error", () => {
      setErrorText("Could not connect to server.");
      setStatusText("");
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const area = messageAreaRef.current;
    if (area) {
      area.scrollTop = area.scrollHeight;
    }
  }, [messages, activeChat]);

  const connect = (event) => {
    event.preventDefault();
    const name = usernameInput.trim();
    if (!name || !socketRef.current) {
      return;
    }

    setErrorText("");
    setStatusText("Connecting...");

    const socket = socketRef.current;
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("register", name, (result) => {
      if (!result?.ok) {
        setErrorText(result?.error || "Failed to register user.");
        setStatusText("");
        return;
      }

      setUsername(result.username);
      setStatusText("Connected");
    });
  };

  const sendMessage = (event) => {
    event.preventDefault();
    const content = messageInput.trim();
    const to = activeChat.trim();
    const socket = socketRef.current;

    if (!socket || !socket.connected || !content || !to) {
      return;
    }

    setErrorText("");
    socket.emit("private_message", { to, content }, (result) => {
      if (!result?.ok) {
        setErrorText(result?.error || "Failed to send message.");
      }
    });
    setMessageInput("");
  };

  const sendFileAsMessage = (file) => {
    if (!file || !activeChat || !socketRef.current) {
      return;
    }
    socketRef.current.emit(
      "private_message",
      { to: activeChat, content: `[File] ${file.name}` },
      (result) => {
        if (!result?.ok) {
          setErrorText(result?.error || "Failed to send file.");
        }
      }
    );
  };

  const conversations = useMemo(() => {
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
  }, [messages, searchTerm, usersOnline, username]);

  const activeThread = useMemo(() => {
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
  }, [messages, activeChat, username]);

  const openConversation = (user) => {
    setActiveChat(user);
    setUnreadByUser((prev) => ({ ...prev, [user]: 0 }));
  };

  const connectingText = errorText || statusText;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0" />
        <title>Realtime Chat</title>
      </Head>

      {!username ? (
        <div id="username-page">
          <div className="username-page-container">
            <h1 className="title">Type your username to enter the chat</h1>
            <form id="usernameForm" name="usernameForm" onSubmit={connect}>
              <div className="form-group">
                <input
                  type="text"
                  id="name"
                  placeholder="Username"
                  autoComplete="off"
                  className="form-control"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                />
              </div>
              <div className="form-group">
                <button type="submit" className="accent username-submit">
                  Start Chatting
                </button>
              </div>
            </form>
            {connectingText && (
              <p className={errorText ? "error-text" : "status-text"}>{connectingText}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="app-shell">
          <aside className="left-sidebar">
            <div className="app-logo">RT</div>
            <nav className="nav-icons">
              <button
                type="button"
                className={`nav-icon-btn${activeNav === "chat" ? " active" : ""}`}
                onClick={() => setActiveNav("chat")}
              >
                Chat
              </button>
              <button
                type="button"
                className={`nav-icon-btn${activeNav === "groups" ? " active" : ""}`}
                onClick={() => setActiveNav("groups")}
              >
                Teams
              </button>
              <button
                type="button"
                className={`nav-icon-btn${activeNav === "calls" ? " active" : ""}`}
                onClick={() => setActiveNav("calls")}
              >
                Calls
              </button>
              <button
                type="button"
                className={`nav-icon-btn${activeNav === "settings" ? " active" : ""}`}
                onClick={() => setActiveNav("settings")}
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
          </aside>

          <aside className="middle-sidebar">
            <div className="search-wrap">
              <input
                type="text"
                className="search-input"
                placeholder="Search chats"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <ul className="chat-list">
              {conversations.map((entry) => (
                <li key={entry.user}>
                  <button
                    type="button"
                    className={`chat-list-item${activeChat === entry.user ? " selected" : ""}`}
                    onClick={() => openConversation(entry.user)}
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

          <main className="main-chat">
            <header className="main-chat-header">
              <h2>{activeChat || "Select a conversation"}</h2>
              <p>{activeChat ? `Private chat with ${activeChat}` : "Choose a user from chat list."}</p>
            </header>

            <ul className="message-thread" ref={messageAreaRef}>
              {activeThread.map((message, index) => {
                if (message.type === "SYSTEM") {
                  return (
                    <li key={`${message.content}-${index}`} className="system-row">
                      <span>{message.content}</span>
                    </li>
                  );
                }

                const isSender = message.sender === username;
                return (
                  <li
                    key={`${message.sender}-${index}-${message.content}`}
                    className={`message-row ${isSender ? "sender" : "receiver"}`}
                  >
                    <div className="message-bubble">
                      <p>{message.content}</p>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <form className="chat-input-bar" onSubmit={sendMessage}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setMessageInput((v) => `${v} \u{1F600}`)}
              >
                Emoji
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden-file"
                onChange={(e) => {
                  sendFileAsMessage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <input
                type="text"
                className="message-input"
                placeholder={activeChat ? "Type a message" : "Select a chat first"}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={!activeChat}
              />
              <button type="submit" className="send-btn" disabled={!activeChat}>
                Send
              </button>
            </form>
          </main>
        </div>
      )}
    </>
  );
}
