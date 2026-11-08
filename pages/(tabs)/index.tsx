import { Link } from "@void/react";
import { ChevronRight } from "lucide-react";
import { AppBar } from "@pocket/ui/app-bar";
import { AccountPanel } from "@/account/auth-gate";
import { appCatalog } from "@/app-catalog";

export default function PortalPage() {
  return (
    <>
      <AppBar title={<img src="/pocket-horizontal.svg" alt="Pocket" width={88} height={32} />} />
      <main className="page">
        <ul className="portal-list" aria-label="アプリ一覧">
          {appCatalog.map((app) => (
            <li key={app.id}>
              <Link className="portal-card" href={app.href}>
                <span className="portal-icon">
                  <app.icon aria-hidden="true" />
                </span>
                <span className="portal-text">
                  <span className="portal-name">{app.name}</span>
                  <span className="portal-description">{app.description}</span>
                </span>
                <ChevronRight className="portal-chevron" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <AccountPanel />
      </main>
    </>
  );
}
