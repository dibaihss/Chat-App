import "../styles/main.css";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "../src/auth/msalConfig";

export default function App({ Component, pageProps }) {
  return (
    <MsalProvider instance={msalInstance}>
      <Component {...pageProps} />
    </MsalProvider>
  );
}
