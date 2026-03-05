import ConversationList from "./ConversationList";
import LeftSidebar from "./LeftSidebar";
import MessageInputBar from "./MessageInputBar";
import MessageThread from "./MessageThread";
import { getAvatarColor } from "../utils/avatarColor";
import { formatTime } from "../utils/chatFormat";

export default function AppShell({ controller }) {
  const { state, conversations, activeThread } = controller;

  return (
    <div className="app-shell">
      <LeftSidebar
        username={state.username}
        activeNav={state.activeNav}
        onActiveNavChange={controller.setActiveNav}
        getAvatarColor={getAvatarColor}
      />

      <ConversationList
        searchTerm={state.searchTerm}
        onSearchTermChange={controller.setSearchTerm}
        conversations={conversations}
        activeChat={state.activeChat}
        onOpenConversation={controller.openConversation}
        unreadByUser={state.unreadByUser}
        getAvatarColor={getAvatarColor}
        formatTime={formatTime}
      />

      <main className="main-chat">
        <header className="main-chat-header">
          <h2>{state.activeChat || "Select a conversation"}</h2>
          <p>
            {state.activeChat
              ? `Private chat with ${state.activeChat}`
              : "Choose a user from chat list."}
          </p>
        </header>

        <MessageThread
          activeThread={activeThread}
          username={state.username}
          messageAreaRef={controller.messageAreaRef}
          formatTime={formatTime}
        />

        <MessageInputBar
          activeChat={state.activeChat}
          messageInput={state.messageInput}
          onMessageInputChange={controller.setMessageInput}
          onSubmit={controller.sendMessage}
          onAddEmoji={controller.addEmoji}
          onOpenFilePicker={controller.openFilePicker}
          fileInputRef={controller.fileInputRef}
          onFileChange={controller.handleFileChange}
        />
      </main>
    </div>
  );
}
