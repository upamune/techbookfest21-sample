import { useCallback, useEffect, useState } from "react";
import { Boxes, Plus, RefreshCw, Search } from "lucide-react";
import { callTool } from "@pocket/tools/request";
import { useMutation } from "@pocket/tools/use-mutation";
import { useToolQuery } from "@pocket/tools/use-tool-query";
import { AppBar } from "@pocket/ui/app-bar";
import { Button } from "@pocket/ui/button";
import { EmptyState, ErrorNotice, Snackbar, type SnackbarMessage } from "@pocket/ui/feedback";
import { Input } from "@pocket/ui/input";
import { Skeleton } from "@pocket/ui/skeleton";
import { deletionOutput, itemListOutput, type Item } from "./contracts";
import { ItemCard } from "./item-card";
import { ItemSheet, type ItemSheetMode } from "./item-sheet";

const searchDelay = 250;

function useDebouncedValue(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), searchDelay);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

export function ItemsPage() {
  const [query, setQuery] = useState("");
  const activeQuery = useDebouncedValue(query.trim());
  const { state, refresh } = useToolQuery({
    name: "things_search_items",
    input: { query: activeQuery },
    schema: itemListOutput,
  });
  const [sheet, setSheet] = useState<ItemSheetMode | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarMessage | null>(null);
  const dismissSnackbar = useCallback(() => setSnackbar(null), []);
  const restore = useMutation();

  function announceDeleted(item: Item) {
    setSnackbar({
      text: `「${item.name}」を削除しました`,
      undo: () => {
        setSnackbar(null);
        void restore.run(async () => {
          await callTool({
            name: "things_set_item_deleted",
            input: { id: item.id, deleted: false },
            schema: deletionOutput,
          });
          await refresh();
        });
      },
    });
  }

  return (
    <>
      <AppBar
        title="Things"
        actions={
          <Button
            variant="ghost"
            size="icon"
            aria-label="更新"
            disabled={state.kind === "loading" || state.kind === "refreshing"}
            onClick={() => void refresh()}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        }
      />
      <div className="search-bar" role="search">
        <Search aria-hidden="true" />
        <Input
          type="search"
          aria-label="持ち物を検索"
          placeholder="名前・場所・カテゴリで検索"
          enterKeyHint="search"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <main className="page" aria-busy={state.kind === "loading" || state.kind === "refreshing"}>
        {restore.error && <ErrorNotice message={restore.error} />}
        {state.kind === "stale" && <ErrorNotice message={state.message} />}
        {state.kind === "loading" && <ItemGridSkeleton />}
        {state.kind === "failed" && (
          <ErrorNotice message={state.message} onRetry={() => void refresh()} />
        )}
        {"data" in state && (
          <ItemList
            items={state.data.items}
            searching={activeQuery.length > 0}
            onSelect={(item) => setSheet({ kind: "edit", item })}
          />
        )}
      </main>
      <button
        type="button"
        className="fab"
        aria-label="持ち物を追加"
        onClick={() => setSheet({ kind: "add" })}
      >
        <Plus aria-hidden="true" />
      </button>
      <Snackbar message={snackbar} onDismiss={dismissSnackbar} />
      <ItemSheet
        mode={sheet}
        onClose={() => setSheet(null)}
        onSaved={() => void refresh()}
        onDeleted={(item) => {
          announceDeleted(item);
          void refresh();
        }}
      />
    </>
  );
}

function ItemList({
  items,
  searching,
  onSelect,
}: {
  items: Item[];
  searching: boolean;
  onSelect: (item: Item) => void;
}) {
  if (items.length === 0)
    return searching ? (
      <EmptyState icon={Search} title="見つかりませんでした">
        別のことばで検索してみてください。
      </EmptyState>
    ) : (
      <EmptyState icon={Boxes} title="まだ持ち物はありません">
        右下のボタンから、最初の持ち物を追加できます。
      </EmptyState>
    );
  return (
    <ul className="thing-grid">
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} onSelect={() => onSelect(item)} />
        </li>
      ))}
    </ul>
  );
}

const skeletonWidths = ["72%", "54%", "66%", "48%", "60%", "78%"];

function ItemGridSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        読み込み中…
      </p>
      <ul className="thing-grid" aria-hidden="true">
        {skeletonWidths.map((width) => (
          <li key={width}>
            <div className="thing-card">
              <Skeleton className="thing-thumb" />
              <span className="thing-name">
                <Skeleton className="skeleton-line" style={{ width }} />
              </span>
              <span className="thing-place">
                <Skeleton className="skeleton-line skeleton-meta" />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
