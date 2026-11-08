import type { ReactNode } from "react";
import { AppNavLinks } from "@/app-nav";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tab-screen">
      {children}
      <nav className="bottom-nav" aria-label="アプリ">
        <AppNavLinks className="bottom-nav-item" />
      </nav>
    </div>
  );
}
