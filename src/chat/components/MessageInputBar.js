export default function MessageInputBar({
  activeChat,
  messageInput,
  onMessageInputChange,
  onSubmit,
  onAddEmoji,
  onOpenFilePicker,
  fileInputRef,
  onFileChange
}) {
  return (
    <form className="chat-input-bar" onSubmit={onSubmit}>
      <button type="button" className="icon-btn" onClick={onAddEmoji}>
        Emoji
      </button>
      <button type="button" className="icon-btn" onClick={onOpenFilePicker}>
        File
      </button>
      <input ref={fileInputRef} type="file" className="hidden-file" onChange={onFileChange} />
      <input
        type="text"
        className="message-input"
        placeholder={activeChat ? "Type a message" : "Select a chat first"}
        value={messageInput}
        onChange={(e) => onMessageInputChange(e.target.value)}
        disabled={!activeChat}
      />
      <button type="submit" className="send-btn" disabled={!activeChat}>
        Send
      </button>
    </form>
  );
}
