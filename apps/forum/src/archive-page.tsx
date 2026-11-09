import { Archive } from "lucide-react";
import { AppBar } from "@pocket/ui/app-bar";
import { EmptyState } from "@pocket/ui/feedback";
import { ThreadListMain } from "./thread-list";

export function ArchivePage() {
  return (
    <>
      <AppBar title="アーカイブ" parent={{ label: "Forum", href: "/forum" }} />
      <ThreadListMain
        archived
        empty={
          <EmptyState icon={Archive} title="アーカイブしたスレッドはありません">
            スレッドを開き、右上のボタンからアーカイブできます。
          </EmptyState>
        }
      />
    </>
  );
}
