import { useEffect, useMemo, useReducer, useRef } from "react";
import { io } from "socket.io-client";
import { CHAT_ACTIONS, chatReducer, initialChatState } from "../state/chatReducer";
import { buildActiveThread, buildConversations, getConnectingText } from "../state/selectors";

export function useChatController() {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);

  const socketRef = useRef(null);
  const messageAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const usernameRef = useRef("");
  const activeChatRef = useRef("");

  useEffect(() => {
    usernameRef.current = state.username;
  }, [state.username]);

  useEffect(() => {
    activeChatRef.current = state.activeChat;
  }, [state.activeChat]);

  useEffect(() => {
    const socket = io({ autoConnect: false });
    socketRef.current = socket;

    socket.on("private_message", (message) => {
      dispatch({
        type: CHAT_ACTIONS.MESSAGE_RECEIVED,
        payload: { ...message, type: "CHAT" }
      });

      if (
        message.sender !== usernameRef.current &&
        message.sender !== activeChatRef.current
      ) {
        dispatch({ type: CHAT_ACTIONS.UNREAD_INCREMENT, payload: message.sender });
      }
    });

    socket.on("system_message", (content) => {
      dispatch({ type: CHAT_ACTIONS.SYSTEM_MESSAGE_RECEIVED, payload: content });
    });

    socket.on("users_online", (users) => {
      dispatch({ type: CHAT_ACTIONS.USERS_ONLINE_UPDATED, payload: users });
    });

    socket.on("connect_error", () => {
      dispatch({ type: CHAT_ACTIONS.CONNECT_ERROR, payload: "Could not connect to server." });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const area = messageAreaRef.current;
    if (area) {
      area.scrollTop = area.scrollHeight;
    }
  }, [state.messages, state.activeChat]);

  const conversations = useMemo(
    () =>
      buildConversations(state.messages, state.usersOnline, state.username, state.searchTerm),
    [state.messages, state.searchTerm, state.usersOnline, state.username]
  );

  const activeThread = useMemo(
    () => buildActiveThread(state.messages, state.activeChat, state.username),
    [state.messages, state.activeChat, state.username]
  );

  const connectingText = useMemo(
    () => getConnectingText(state.errorText, state.statusText),
    [state.errorText, state.statusText]
  );

  const connect = (event) => {
    event.preventDefault();
    const name = state.usernameInput.trim();
    if (!name || !socketRef.current) {
      return;
    }

    dispatch({ type: CHAT_ACTIONS.CONNECT_START });

    const socket = socketRef.current;
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("register", name, (result) => {
      if (!result?.ok) {
        dispatch({
          type: CHAT_ACTIONS.CONNECT_ERROR,
          payload: result?.error || "Failed to register user."
        });
        return;
      }

      dispatch({
        type: CHAT_ACTIONS.CONNECT_SUCCESS,
        payload: { username: result.username }
      });
    });
  };

  const sendMessage = (event) => {
    event.preventDefault();
    const content = state.messageInput.trim();
    const to = state.activeChat.trim();
    const socket = socketRef.current;

    if (!socket || !socket.connected || !content || !to) {
      return;
    }

    dispatch({ type: CHAT_ACTIONS.CLEAR_ERROR });
    socket.emit("private_message", { to, content }, (result) => {
      if (!result?.ok) {
        dispatch({
          type: CHAT_ACTIONS.SEND_ERROR,
          payload: result?.error || "Failed to send message."
        });
      }
    });
    dispatch({ type: CHAT_ACTIONS.SET_MESSAGE_INPUT, payload: "" });
  };

  const sendFileAsMessage = (file) => {
    if (!file || !state.activeChat || !socketRef.current) {
      return;
    }

    socketRef.current.emit(
      "private_message",
      { to: state.activeChat, content: `[File] ${file.name}` },
      (result) => {
        if (!result?.ok) {
          dispatch({
            type: CHAT_ACTIONS.SEND_ERROR,
            payload: result?.error || "Failed to send file."
          });
        }
      }
    );
  };

  const openConversation = (user) => {
    dispatch({ type: CHAT_ACTIONS.SET_ACTIVE_CHAT, payload: user });
    dispatch({ type: CHAT_ACTIONS.UNREAD_RESET, payload: user });
  };

  const setUsernameInput = (value) => {
    dispatch({ type: CHAT_ACTIONS.SET_USERNAME_INPUT, payload: value });
  };

  const setActiveNav = (value) => {
    dispatch({ type: CHAT_ACTIONS.SET_ACTIVE_NAV, payload: value });
  };

  const setSearchTerm = (value) => {
    dispatch({ type: CHAT_ACTIONS.SET_SEARCH_TERM, payload: value });
  };

  const setMessageInput = (value) => {
    dispatch({ type: CHAT_ACTIONS.SET_MESSAGE_INPUT, payload: value });
  };

  const addEmoji = () => {
    setMessageInput(`${state.messageInput} \u{1F600}`);
  };

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    sendFileAsMessage(event.target.files?.[0]);
    event.target.value = "";
  };

  return {
    state,
    conversations,
    activeThread,
    connectingText,
    messageAreaRef,
    fileInputRef,
    connect,
    sendMessage,
    sendFileAsMessage,
    openConversation,
    setUsernameInput,
    setActiveNav,
    setSearchTerm,
    setMessageInput,
    addEmoji,
    openFilePicker,
    handleFileChange
  };
}
