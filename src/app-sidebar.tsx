import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { crossfade } from "@pocket/tools/crossfade";
import { Button } from "@pocket/ui/button";
import { AppNavLinks } from "@/app-nav";

const storageKey = "pocket-sidebar";

function applyCollapsed(collapsed: boolean) {
  const { dataset } = document.documentElement;
  if (collapsed) dataset.sidebar = "collapsed";
  else delete dataset.sidebar;
}

function rememberCollapsed(collapsed: boolean) {
  try {
    if (collapsed) localStorage.setItem(storageKey, "collapsed");
    else localStorage.removeItem(storageKey);
  } catch {
    return;
  }
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebar === "collapsed");
  }, []);
  function toggle() {
    const next = !collapsed;
    crossfade(() => {
      applyCollapsed(next);
      setCollapsed(next);
    });
    rememberCollapsed(next);
  }
  return (
    <nav className="app-sidebar" aria-label="アプリ">
      <Button
        className="sidebar-toggle"
        variant="ghost"
        size="icon"
        aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        <PanelLeftClose className="sidebar-icon-close" aria-hidden="true" />
        <PanelLeftOpen className="sidebar-icon-open" aria-hidden="true" />
      </Button>
      <AppNavLinks className="sidebar-item" />
    </nav>
  );
}
