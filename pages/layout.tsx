import type { ReactNode } from "react";
import { AskAiToolsProvider } from "@pocket/ask-ai/ask-ai-button";
import { useKeyboardInset } from "@pocket/ui/use-keyboard-inset";
import { AuthGate } from "@/account/auth-gate";
import { appAskAiTools } from "@/app-ask-ai-tools";
import { AppSidebar } from "@/app-sidebar";
import "./style.css";

function AppFrame({ children }: { children: ReactNode }) {
  return (
    <AskAiToolsProvider value={appAskAiTools}>
      <AppSidebar />
      <div className="app-frame">{children}</div>
    </AskAiToolsProvider>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  useKeyboardInset();
  return import.meta.env.DEV ? (
    <AppFrame>{children}</AppFrame>
  ) : (
    <AuthGate>
      <AppFrame>{children}</AppFrame>
    </AuthGate>
  );
}
