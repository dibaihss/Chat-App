export default function MessageThread({
  activeThread,
  userId,
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

        const isSender = message.senderId === userId;
        return (
          <li
            key={`${message.senderId}-${index}-${message.content}`}
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
