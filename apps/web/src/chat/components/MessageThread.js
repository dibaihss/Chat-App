export default function MessageThread({
  activeThread,
  username,
  messageAreaRef,
  formatTime
}) {
  return (
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
  );
}
