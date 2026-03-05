import { useEffect, useMemo, useReducer, useRef } from "react";
import { io } from "socket.io-client";
import { CHAT_ACTIONS, chatReducer, initialChatState } from "../state/chatReducer";
import { buildActiveThread, buildConversations, getConnectingText } from "../state/selectors";

export function useChatController() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_CHAT_API_URL || "http://localhost:3001";
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const createIdempotencyKey = () =>
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
    const socket = io(apiBaseUrl, { autoConnect: false });
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

    socket.on("room_message", (message) => {
      dispatch({
        type: CHAT_ACTIONS.MESSAGE_RECEIVED,
        payload: { ...message, type: "CHAT" }
      });
    });

    socket.on("connect_error", () => {
      dispatch({ type: CHAT_ACTIONS.CONNECT_ERROR, payload: "Could not connect to server." });
    });

    return () => socket.disconnect();
  }, [apiBaseUrl]);

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
    () => buildActiveThread(state.messages, state.activeRoomId),
    [state.messages, state.activeRoomId]
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

  const loadRoomHistoryPage = async (roomId, continuation) => {
    const query = new URLSearchParams({ limit: "50" });
    if (continuation) {
      query.set("continuation", continuation);
    }

    const response = await fetch(`${apiBaseUrl}/rooms/${encodeURIComponent(roomId)}/messages?${query}`, {
      headers: {
        "x-user-id": state.username
      }
    });

    const result = await response.json();
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || "Failed to load room history.");
    }

    dispatch({
      type: CHAT_ACTIONS.HISTORY_LOADED,
      payload: {
        roomId,
        messages: result.messages || [],
        continuation: result.continuation || null
      }
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
    socket.emit("private_message", { to, content, idempotencyKey: createIdempotencyKey() }, (result) => {
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
      { to: state.activeChat, content: `[File] ${file.name}`, idempotencyKey: createIdempotencyKey() },
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
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      return;
    }

    socket.emit("open_room", { peerUser: user }, async (result) => {
      if (!result?.ok) {
        dispatch({
          type: CHAT_ACTIONS.SEND_ERROR,
          payload: result?.error || "Failed to open room."
        });
        return;
      }

      dispatch({
        type: CHAT_ACTIONS.SET_ACTIVE_CHAT,
        payload: user,
        roomId: result.roomId
      });
      dispatch({ type: CHAT_ACTIONS.UNREAD_RESET, payload: user });

      dispatch({
        type: CHAT_ACTIONS.HISTORY_LOADED,
        payload: {
          roomId: result.roomId,
          messages: result.messages || [],
          continuation: result.continuation || null
        }
      });

      if (result.continuation) {
        try {
          await loadRoomHistoryPage(result.roomId, result.continuation);
        } catch (error) {
          dispatch({
            type: CHAT_ACTIONS.SEND_ERROR,
            payload: error.message || "Failed to load extra history."
          });
        }
      }
    });
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
    loadRoomHistoryPage,
    setUsernameInput,
    setActiveNav,
    setSearchTerm,
    setMessageInput,
    addEmoji,
    openFilePicker,
    handleFileChange
  };
}
