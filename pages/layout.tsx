import type { ReactNode } from "react";
import { useKeyboardInset } from "@pocket/ui/use-keyboard-inset";
import { AuthGate } from "@/account/auth-gate";
import "./style.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  useKeyboardInset();
  return import.meta.env.DEV ? children : <AuthGate>{children}</AuthGate>;
}
