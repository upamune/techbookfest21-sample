import { Link } from "@void/react";
import { House } from "lucide-react";
import { appCatalog } from "@/app-catalog";

export function AppNavLinks({ className }: { className: string }) {
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
    </>
  );
}
