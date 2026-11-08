import type { ReactNode } from "react";
import { Link } from "@void/react";
import { House } from "lucide-react";
import { appCatalog } from "@/app-catalog";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tab-screen">
      {children}
      <nav className="bottom-nav" aria-label="アプリ">
        <Link className="bottom-nav-item" href="/" activeMatch="exact">
          <House aria-hidden="true" />
          <span>ホーム</span>
        </Link>
        {appCatalog.map((app) => (
          <Link key={app.id} className="bottom-nav-item" href={app.href} activeMatch="prefix">
            <app.icon aria-hidden="true" />
            <span>{app.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
