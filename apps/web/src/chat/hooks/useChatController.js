import { useEffect, useMemo, useReducer, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { io } from "socket.io-client";
import { CHAT_ACTIONS, chatReducer, initialChatState } from "../state/chatReducer";
import { buildActiveThread, buildConversations, getConnectingText } from "../state/selectors";
import { apiScope, loginRequest } from "../../auth/msalConfig";

export function useChatController() {
  const { instance } = useMsal();
  const apiBaseUrl = process.env.NEXT_PUBLIC_CHAT_API_URL || "http://localhost:3001";
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const createIdempotencyKey = () =>
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const socketRef = useRef(null);
  const messageAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const tokenRef = useRef("");
  const userIdRef = useRef("");
  const activeChatUserIdRef = useRef("");
  const authBootstrappedRef = useRef(false);
  const msalInitPromiseRef = useRef(null);

  const ensureMsalInitialized = async () => {
    if (!msalInitPromiseRef.current) {
      msalInitPromiseRef.current = instance.initialize();
    }
    await msalInitPromiseRef.current;
  };

  useEffect(() => {
    tokenRef.current = state.accessToken;
  }, [state.accessToken]);

  useEffect(() => {
    userIdRef.current = state.userId;
  }, [state.userId]);

  useEffect(() => {
    activeChatUserIdRef.current = state.activeChatUserId;
  }, [state.activeChatUserId]);

  useEffect(() => {
    const socket = io(apiBaseUrl, {
      autoConnect: false,
      auth: (cb) => {
        cb({ token: tokenRef.current });
      }
    });
    socketRef.current = socket;

    socket.on("private_message", (message) => {
      dispatch({
        type: CHAT_ACTIONS.MESSAGE_RECEIVED,
        payload: { ...message, type: "CHAT" }
      });

      if (
        message.senderId !== userIdRef.current &&
        message.senderId !== activeChatUserIdRef.current
      ) {
        dispatch({ type: CHAT_ACTIONS.UNREAD_INCREMENT, payload: message.senderId });
      }
    });

    socket.on("system_message", (content) => {
      dispatch({ type: CHAT_ACTIONS.SYSTEM_MESSAGE_RECEIVED, payload: content });
    });

    socket.on("users_online", (users) => {
      dispatch({ type: CHAT_ACTIONS.USERS_ONLINE_UPDATED, payload: users || [] });
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
    () => buildConversations(state.messages, state.usersOnline, state.userId, state.searchTerm),
    [state.messages, state.searchTerm, state.usersOnline, state.userId]
  );

  const activeThread = useMemo(
    () => buildActiveThread(state.messages, state.activeRoomId),
    [state.messages, state.activeRoomId]
  );

  const connectingText = useMemo(
    () => getConnectingText(state.errorText, state.statusText),
    [state.errorText, state.statusText]
  );

  const completeAuthSession = async (account, accessToken) => {
    const userId =
      account?.idTokenClaims?.oid ||
      account?.localAccountId ||
      account?.homeAccountId;
    const username = account?.name || account?.username || userId;

    dispatch({
      type: CHAT_ACTIONS.CONNECT_SUCCESS,
      payload: { userId, username, accessToken }
    });
    console.log("Auth session completed successfully:", { userId, username, accessToken });

    const syncResponse = await fetch(`${apiBaseUrl}/auth/sync-user`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!syncResponse.ok) {
      throw new Error("Failed to sync Entra user to backend profile store.");
    }

    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    socket.auth = { token: accessToken };
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("register", null, (result) => {
      if (!result?.ok) {
        dispatch({
          type: CHAT_ACTIONS.CONNECT_ERROR,
          payload: result?.error || "Failed to register user."
        });
      }
    });
  };

  const acquireAccessToken = async (account) => {
    await ensureMsalInitialized();
    const tokenRequest = {
      ...loginRequest,
      account,
      scopes: apiScope ? [apiScope] : []
    };

    try {
      const result = await instance.acquireTokenSilent(tokenRequest);
      return result.accessToken;
    } catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) {
        throw error;
      }
      const interactive = await instance.acquireTokenPopup(tokenRequest);
      return interactive.accessToken;
    }
  };

  useEffect(() => {
    if (authBootstrappedRef.current) {
      return;
    }
    authBootstrappedRef.current = true;

    const bootstrap = async () => {
      try {
        await ensureMsalInitialized();
        const redirectResult = await instance.handleRedirectPromise();
        const account =
          redirectResult?.account ||
          instance.getActiveAccount() ||
          instance.getAllAccounts()[0];

        if (!account) {
          return;
        }

        dispatch({ type: CHAT_ACTIONS.CONNECT_START });
        instance.setActiveAccount(account);
        if (!apiScope) {
          throw new Error("NEXT_PUBLIC_CHAT_API_SCOPE is not configured.");
        }

        const accessToken = await acquireAccessToken(account);
        console.log("Access token acquired successfully during bootstrap.", accessToken);
        await completeAuthSession(account, accessToken);
      } catch (error) {
        dispatch({
          type: CHAT_ACTIONS.CONNECT_ERROR,
          payload: error?.message || "Failed to complete sign-in redirect."
        });
      }
    };

    bootstrap();
  }, [instance]);

  const signIn = async () => {
    try {
      await ensureMsalInitialized();
      if (!apiScope) {
        throw new Error("NEXT_PUBLIC_CHAT_API_SCOPE is not configured.");
      }
      dispatch({ type: CHAT_ACTIONS.CONNECT_START });

      await instance.loginRedirect({
        ...loginRequest,
        scopes: apiScope ? [apiScope] : []
      });
    } catch (error) {
      dispatch({
        type: CHAT_ACTIONS.CONNECT_ERROR,
        payload: error?.message || "Failed to sign in with Microsoft."
      });
    }
  };

  const signOut = async () => {
    await ensureMsalInitialized();
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.disconnect();
    }
    dispatch({ type: CHAT_ACTIONS.SIGN_OUT });
    const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
    if (account) {
      await instance.logoutPopup({ account });
    }
  };

  const loadRoomHistoryPage = async (roomId, continuation) => {
    const query = new URLSearchParams({ limit: "50" });
    if (continuation) {
      query.set("continuation", continuation);
    }

    const response = await fetch(`${apiBaseUrl}/rooms/${encodeURIComponent(roomId)}/messages?${query}`, {
      headers: {
        Authorization: `Bearer ${state.accessToken}`
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
    const toUserId = state.activeChatUserId.trim();
    const socket = socketRef.current;

    if (!socket || !socket.connected || !content || !toUserId) {
      return;
    }

    dispatch({ type: CHAT_ACTIONS.CLEAR_ERROR });
    socket.emit(
      "private_message",
      { toUserId, content, idempotencyKey: createIdempotencyKey() },
      (result) => {
        if (!result?.ok) {
          dispatch({
            type: CHAT_ACTIONS.SEND_ERROR,
            payload: result?.error || "Failed to send message."
          });
        }
      }
    );
    dispatch({ type: CHAT_ACTIONS.SET_MESSAGE_INPUT, payload: "" });
  };

  const sendFileAsMessage = (file) => {
    if (!file || !state.activeChatUserId || !socketRef.current) {
      return;
    }

    socketRef.current.emit(
      "private_message",
      {
        toUserId: state.activeChatUserId,
        content: `[File] ${file.name}`,
        idempotencyKey: createIdempotencyKey()
      },
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

  const openConversation = (entry) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      return;
    }

    socket.emit("open_room", { peerUserId: entry.userId }, async (result) => {
      if (!result?.ok) {
        dispatch({
          type: CHAT_ACTIONS.SEND_ERROR,
          payload: result?.error || "Failed to open room."
        });
        return;
      }

      dispatch({
        type: CHAT_ACTIONS.SET_ACTIVE_CHAT,
        payload: {
          userId: entry.userId,
          displayName: entry.displayName
        },
        roomId: result.roomId
      });
      dispatch({ type: CHAT_ACTIONS.UNREAD_RESET, payload: entry.userId });

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
    signIn,
    signOut,
    sendMessage,
    sendFileAsMessage,
    openConversation,
    loadRoomHistoryPage,
    setActiveNav,
    setSearchTerm,
    setMessageInput,
    addEmoji,
    openFilePicker,
    handleFileChange
  };
}
