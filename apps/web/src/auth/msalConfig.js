import { PublicClientApplication } from "@azure/msal-browser";

const tenantId = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID || "";
const clientId = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID || "";
const authority =
  process.env.NEXT_PUBLIC_ENTRA_AUTHORITY ||
  (tenantId ? `https://login.microsoftonline.com/${tenantId}` : "");

export const apiScope = process.env.NEXT_PUBLIC_CHAT_API_SCOPE || "";

export const msalConfig = {
  auth: {
    clientId,
    authority,
    redirectUri: process.env.NEXT_PUBLIC_ENTRA_REDIRECT_URI || "http://localhost:3000"
  },
  cache: {
    cacheLocation: "sessionStorage"
  }
};

export const loginRequest = {
  scopes: apiScope ? [apiScope] : []
};

export const msalInstance = new PublicClientApplication(msalConfig);
