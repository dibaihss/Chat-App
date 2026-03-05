export default function LoginScreen({
  usernameInput,
  onUsernameInputChange,
  onSubmit,
  connectingText,
  errorText
}) {
  return (
    <div id="username-page">
      <div className="username-page-container">
        <h1 className="title">Type your username to enter the chat</h1>
        <form id="usernameForm" name="usernameForm" onSubmit={onSubmit}>
          <div className="form-group">
            <input
              type="text"
              id="name"
              placeholder="Username"
              autoComplete="off"
              className="form-control"
              value={usernameInput}
              onChange={(e) => onUsernameInputChange(e.target.value)}
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
  );
}
