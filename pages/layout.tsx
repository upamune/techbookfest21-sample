import type { ReactNode } from "react";
import { useKeyboardInset } from "@pocket/ui/use-keyboard-inset";
import { AuthGate } from "@/account/auth-gate";
import { AppSidebar } from "@/app-sidebar";
import "./style.css";

function AppFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <AppSidebar />
      <div className="app-frame">{children}</div>
    </>
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
