export const CHAT_ACTIONS = {
  SET_USERNAME_INPUT: "SET_USERNAME_INPUT",
  CONNECT_START: "CONNECT_START",
  CONNECT_SUCCESS: "CONNECT_SUCCESS",
  CONNECT_ERROR: "CONNECT_ERROR",
  SET_ACTIVE_NAV: "SET_ACTIVE_NAV",
  SET_ACTIVE_CHAT: "SET_ACTIVE_CHAT",
  SET_SEARCH_TERM: "SET_SEARCH_TERM",
  SET_MESSAGE_INPUT: "SET_MESSAGE_INPUT",
  MESSAGE_RECEIVED: "MESSAGE_RECEIVED",
  SYSTEM_MESSAGE_RECEIVED: "SYSTEM_MESSAGE_RECEIVED",
  USERS_ONLINE_UPDATED: "USERS_ONLINE_UPDATED",
  UNREAD_INCREMENT: "UNREAD_INCREMENT",
  UNREAD_RESET: "UNREAD_RESET",
  SEND_ERROR: "SEND_ERROR",
  CLEAR_ERROR: "CLEAR_ERROR"
};

export const initialChatState = {
  usernameInput: "",
  username: "",
  activeNav: "chat",
  activeChat: "",
  searchTerm: "",
  messageInput: "",
  messages: [],
  usersOnline: [],
  unreadByUser: {},
  statusText: "",
  errorText: ""
};

export function chatReducer(state, action) {
  switch (action.type) {
    case CHAT_ACTIONS.SET_USERNAME_INPUT:
      return { ...state, usernameInput: action.payload };
    case CHAT_ACTIONS.CONNECT_START:
      return { ...state, statusText: "Connecting...", errorText: "" };
    case CHAT_ACTIONS.CONNECT_SUCCESS:
      return { ...state, username: action.payload.username, statusText: "Connected", errorText: "" };
    case CHAT_ACTIONS.CONNECT_ERROR:
      return { ...state, statusText: "", errorText: action.payload };
    case CHAT_ACTIONS.SET_ACTIVE_NAV:
      return { ...state, activeNav: action.payload };
    case CHAT_ACTIONS.SET_ACTIVE_CHAT:
      return { ...state, activeChat: action.payload };
    case CHAT_ACTIONS.SET_SEARCH_TERM:
      return { ...state, searchTerm: action.payload };
    case CHAT_ACTIONS.SET_MESSAGE_INPUT:
      return { ...state, messageInput: action.payload };
    case CHAT_ACTIONS.MESSAGE_RECEIVED:
      return { ...state, messages: [...state.messages, action.payload] };
    case CHAT_ACTIONS.SYSTEM_MESSAGE_RECEIVED:
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            sender: "system",
            content: action.payload,
            type: "SYSTEM",
            createdAt: new Date().toISOString()
          }
        ]
      };
    case CHAT_ACTIONS.USERS_ONLINE_UPDATED:
      return { ...state, usersOnline: action.payload };
    case CHAT_ACTIONS.UNREAD_INCREMENT: {
      const user = action.payload;
      return {
        ...state,
        unreadByUser: { ...state.unreadByUser, [user]: (state.unreadByUser[user] || 0) + 1 }
      };
    }
    case CHAT_ACTIONS.UNREAD_RESET: {
      const user = action.payload;
      return { ...state, unreadByUser: { ...state.unreadByUser, [user]: 0 } };
    }
    case CHAT_ACTIONS.SEND_ERROR:
      return { ...state, errorText: action.payload };
    case CHAT_ACTIONS.CLEAR_ERROR:
      return { ...state, errorText: "" };
    default:
      return state;
  }
}
