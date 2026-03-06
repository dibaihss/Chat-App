export const CHAT_ACTIONS = {
  CONNECT_START: "CONNECT_START",
  CONNECT_SUCCESS: "CONNECT_SUCCESS",
  CONNECT_ERROR: "CONNECT_ERROR",
  SET_ACTIVE_NAV: "SET_ACTIVE_NAV",
  SET_ACTIVE_CHAT: "SET_ACTIVE_CHAT",
  SET_SEARCH_TERM: "SET_SEARCH_TERM",
  SET_MESSAGE_INPUT: "SET_MESSAGE_INPUT",
  MESSAGE_RECEIVED: "MESSAGE_RECEIVED",
  HISTORY_LOADED: "HISTORY_LOADED",
  SYSTEM_MESSAGE_RECEIVED: "SYSTEM_MESSAGE_RECEIVED",
  USERS_ONLINE_UPDATED: "USERS_ONLINE_UPDATED",
  UNREAD_INCREMENT: "UNREAD_INCREMENT",
  UNREAD_RESET: "UNREAD_RESET",
  SEND_ERROR: "SEND_ERROR",
  CLEAR_ERROR: "CLEAR_ERROR",
  SIGN_OUT: "SIGN_OUT"
};

export const initialChatState = {
  userId: "",
  username: "",
  accessToken: "",
  activeNav: "chat",
  activeChat: "",
  activeChatUserId: "",
  activeRoomId: "",
  searchTerm: "",
  messageInput: "",
  messages: [],
  usersOnline: [],
  unreadByUserId: {},
  roomContinuationById: {},
  statusText: "",
  errorText: ""
};

export function chatReducer(state, action) {
  switch (action.type) {
    case CHAT_ACTIONS.CONNECT_START:
      return { ...state, statusText: "Signing in...", errorText: "" };
    case CHAT_ACTIONS.CONNECT_SUCCESS:
      return {
        ...state,
        userId: action.payload.userId,
        username: action.payload.username,
        accessToken: action.payload.accessToken,
        statusText: "Connected",
        errorText: ""
      };
    case CHAT_ACTIONS.CONNECT_ERROR:
      return { ...state, statusText: "", errorText: action.payload };
    case CHAT_ACTIONS.SET_ACTIVE_NAV:
      return { ...state, activeNav: action.payload };
    case CHAT_ACTIONS.SET_ACTIVE_CHAT:
      return {
        ...state,
        activeChat: action.payload.displayName,
        activeChatUserId: action.payload.userId,
        activeRoomId: action.payload.roomId || state.activeRoomId
      };
    case CHAT_ACTIONS.SET_SEARCH_TERM:
      return { ...state, searchTerm: action.payload };
    case CHAT_ACTIONS.SET_MESSAGE_INPUT:
      return { ...state, messageInput: action.payload };
    case CHAT_ACTIONS.MESSAGE_RECEIVED:
      if (state.messages.some((msg) => msg.id && msg.id === action.payload.id)) {
        return state;
      }
      return { ...state, messages: [...state.messages, action.payload] };
    case CHAT_ACTIONS.HISTORY_LOADED: {
      const incoming = action.payload.messages || [];
      const existingById = new Map(
        state.messages.filter((msg) => msg.id).map((msg) => [msg.id, msg])
      );
      incoming.forEach((msg) => {
        if (msg.id) {
          existingById.set(msg.id, msg);
        }
      });

      const deduped = [
        ...state.messages.filter((msg) => !msg.id),
        ...Array.from(existingById.values())
      ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      return {
        ...state,
        messages: deduped,
        activeRoomId: action.payload.roomId || state.activeRoomId,
        roomContinuationById: {
          ...state.roomContinuationById,
          ...(action.payload.roomId
            ? { [action.payload.roomId]: action.payload.continuation || null }
            : {})
        }
      };
    }
    case CHAT_ACTIONS.SYSTEM_MESSAGE_RECEIVED:
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            senderId: "system",
            senderDisplayName: "System",
            content: action.payload,
            type: "SYSTEM",
            createdAt: new Date().toISOString()
          }
        ]
      };
    case CHAT_ACTIONS.USERS_ONLINE_UPDATED:
      return { ...state, usersOnline: action.payload };
    case CHAT_ACTIONS.UNREAD_INCREMENT: {
      const userId = action.payload;
      return {
        ...state,
        unreadByUserId: { ...state.unreadByUserId, [userId]: (state.unreadByUserId[userId] || 0) + 1 }
      };
    }
    case CHAT_ACTIONS.UNREAD_RESET: {
      const userId = action.payload;
      return { ...state, unreadByUserId: { ...state.unreadByUserId, [userId]: 0 } };
    }
    case CHAT_ACTIONS.SEND_ERROR:
      return { ...state, errorText: action.payload };
    case CHAT_ACTIONS.CLEAR_ERROR:
      return { ...state, errorText: "" };
    case CHAT_ACTIONS.SIGN_OUT:
      return { ...initialChatState };
    default:
      return state;
  }
}
