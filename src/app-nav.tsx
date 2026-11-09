import type { ReactNode } from "react";
import { Link } from "@void/react";
import { House, Settings } from "lucide-react";
import { appCatalog } from "@/app-catalog";

export function AppNavLinks({
  className,
  beforeSettings,
}: {
  className: string;
  beforeSettings?: ReactNode;
}) {
  return (
    <>
      <Link className={className} href="/" activeMatch="exact">
        <House aria-hidden="true" />
        <span>ホーム</span>
      </Link>
      {appCatalog.map((app) => (
        <Link key={app.id} className={className} href={app.href} activeMatch="prefix">
          <app.icon aria-hidden="true" />
          <span>{app.name}</span>
        </Link>
      ))}
      {beforeSettings}
      <Link className={`${className} nav-settings`} href="/settings" activeMatch="prefix">
        <Settings aria-hidden="true" />
        <span>設定</span>
      </Link>
    </>
  );
}
