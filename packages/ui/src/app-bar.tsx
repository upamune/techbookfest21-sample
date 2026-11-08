import type { ComponentProps, ReactNode } from "react";
import { Link } from "@void/react";
import { ChevronLeft } from "lucide-react";

type ParentPage = { label: string; href: ComponentProps<typeof Link>["href"] };

const logo = <img src="/pocket-horizontal.svg" alt="Pocket" width={88} height={32} />;

function Breadcrumb({ current, parent }: { current?: string; parent?: ParentPage }) {
  return (
    <nav className="app-bar-crumbs" aria-label="パンくずリスト">
      <ol>
        <li>{current === undefined ? logo : <Link href="/">{logo}</Link>}</li>
        {parent && (
          <li>
            <Link href={parent.href}>{parent.label}</Link>
          </li>
        )}
        {current !== undefined && <li aria-current="page">{current}</li>}
      </ol>
    </nav>
  );
}

export function AppBar({
  title,
  parent,
  actions,
}: {
  title: ReactNode;
  parent?: ParentPage;
  actions?: ReactNode;
}) {
  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <Breadcrumb current={typeof title === "string" ? title : undefined} parent={parent} />
        {parent && (
          <Link
            className="icon-link app-bar-back"
            href={parent.href}
            aria-label={`${parent.label}に戻る`}
          >
            <ChevronLeft aria-hidden="true" />
          </Link>
        )}
        <h1 className="app-bar-title">{title}</h1>
        <div className="app-bar-actions">{actions}</div>
      </div>
    </header>
  );
}
