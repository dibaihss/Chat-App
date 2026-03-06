export default function LoginScreen({
  onSignIn,
  connectingText,
  errorText
}) {
  return (
    <div id="username-page">
      <div className="username-page-container">
        <h1 className="title">Sign in with Microsoft to enter the chat</h1>
        <button type="button" className="accent username-submit" onClick={onSignIn}>
          Sign in with Microsoft
        </button>
        {connectingText && (
          <p className={errorText ? "error-text" : "status-text"}>{connectingText}</p>
        )}
      </div>
    </div>
  );
}
