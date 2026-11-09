import { useCallback, useEffect, useState } from "react";
import { Boxes, Plus, Search } from "lucide-react";
import { callTool } from "@pocket/tools/request";
import { useMutation } from "@pocket/tools/use-mutation";
import { useToolQuery } from "@pocket/tools/use-tool-query";
import { AskAiButton } from "@pocket/ask-ai/ask-ai-button";
import { AppBar } from "@pocket/ui/app-bar";
import { EmptyState, ErrorNotice, Snackbar, type SnackbarMessage } from "@pocket/ui/feedback";
import { Input } from "@pocket/ui/input";
import { Skeleton } from "@pocket/ui/skeleton";
import {
  deletionOutput,
  itemListOutput,
  itemOptionsOutput,
  type Item,
  type ItemOptions,
} from "./contracts";
import { ItemCard } from "./item-card";
import { ItemSheet, type ItemSheetMode } from "./item-sheet";

const searchDelay = 250;
const aboveFoldCards = 12;

function useDebouncedValue(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), searchDelay);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

const noOptions: ItemOptions = { locations: [], categories: [] };

function useItemOptions() {
  const [options, setOptions] = useState(noOptions);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const loaded = await callTool({
        name: "things_list_options",
        input: {},
        schema: itemOptionsOutput,
        signal,
      });
      setOptions(loaded);
      setFailed(false);
    } catch {
      if (!signal?.aborted) setFailed(true);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);
  return { options, failed, reload };
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
  const itemOptions = useItemOptions();

  function refreshAll() {
    void refresh();
    void itemOptions.reload();
  }

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
          refreshAll();
        });
      },
    });
  }

  return (
    <>
      <AppBar title="Things" />
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
      <AskAiButton floating suggestions={["持ち物を場所ごとに表でまとめて", "玄関にある物は？"]} />
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
        options={itemOptions.options}
        optionsFailed={itemOptions.failed}
        onClose={() => setSheet(null)}
        onSaved={refreshAll}
        onDeleted={(item) => {
          announceDeleted(item);
          refreshAll();
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
      {items.map((item, index) => (
        <li key={item.id}>
          <ItemCard
            item={item}
            aboveFold={index < aboveFoldCards}
            onSelect={() => onSelect(item)}
          />
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
