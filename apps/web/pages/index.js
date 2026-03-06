import Head from "next/head";
import AppShell from "../src/chat/components/AppShell";
import LoginScreen from "../src/chat/components/LoginScreen";
import { useChatController } from "../src/chat/hooks/useChatController";

export default function Home() {
  const controller = useChatController();
  const { state, connectingText } = controller;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0" />
        <title>Realtime Chat</title>
      </Head>

      {!state.username ? (
        <LoginScreen
          onSignIn={controller.signIn}
          connectingText={connectingText}
          errorText={state.errorText}
        />
      ) : (
        <AppShell controller={controller} />
      )}
    </>
  );
}
