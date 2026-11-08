import { useRef, useState, type FormEvent } from "react";
import { callTool } from "@pocket/tools/request";
import { useMutation } from "@pocket/tools/use-mutation";
import { Button } from "@pocket/ui/button";
import { ErrorNotice } from "@pocket/ui/feedback";
import { Input } from "@pocket/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetTitle } from "@pocket/ui/sheet";
import { Textarea } from "@pocket/ui/textarea";
import { deletionOutput, itemOutput, type Item, type PhotoId } from "./contracts";
import { PhotoStrip } from "./photo-strip";
import { uploadPhoto, type DraftPhoto } from "./upload";

export type ItemSheetMode = { kind: "add" } | { kind: "edit"; item: Item };

type Draft = Pick<Item, "name" | "location" | "category" | "note"> & { quantity: string };

function initialDraft(mode: ItemSheetMode): Draft {
  if (mode.kind === "add") return { name: "", location: "", category: "", quantity: "1", note: "" };
  const { name, location, category, quantity, note } = mode.item;
  return { name, location, category, quantity: String(quantity), note };
}

export function ItemSheet({
  mode,
  onClose,
  onSaved,
  onDeleted,
}: {
  mode: ItemSheetMode | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (item: Item) => void;
}) {
  return (
    <Sheet
      open={mode !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {mode && (
        <ItemForm
          key={mode.kind === "edit" ? mode.item.id : "add"}
          mode={mode}
          onClose={onClose}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </Sheet>
  );
}

function ItemForm({
  mode,
  onClose,
  onSaved,
  onDeleted,
}: {
  mode: ItemSheetMode;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (item: Item) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useMutation();
  const [draft, setDraft] = useState(() => initialDraft(mode));
  const [requestId] = useState(() => crypto.randomUUID());
  const [removedPhotos, setRemovedPhotos] = useState<PhotoId[]>([]);
  const [drafts, setDrafts] = useState<DraftPhoto[]>([]);
  const savedPhotos =
    mode.kind === "edit"
      ? mode.item.photos.filter((photo) => !removedPhotos.includes(photo.id))
      : [];
  const setField = (field: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = { ...draft, quantity: Number(draft.quantity) };
    await run(async () => {
      const { item } = await callTool(
        mode.kind === "add"
          ? { name: "things_add_item", input: { ...fields, requestId }, schema: itemOutput }
          : {
              name: "things_update_item",
              input: { ...fields, id: mode.item.id },
              schema: itemOutput,
            },
      );
      try {
        await applyPhotoChanges(item);
      } finally {
        onSaved();
      }
      onClose();
    });
  }

  async function applyPhotoChanges(item: Item) {
    for (const id of removedPhotos)
      await callTool({
        name: "things_set_photo_deleted",
        input: { id, deleted: true },
        schema: deletionOutput,
      });
    setRemovedPhotos([]);
    for (const draft of drafts) {
      await uploadPhoto({ itemId: item.id, draft });
      setDrafts((current) => current.filter((candidate) => candidate.id !== draft.id));
    }
  }

  function remove(item: Item) {
    void run(async () => {
      await callTool({
        name: "things_set_item_deleted",
        input: { id: item.id, deleted: true },
        schema: deletionOutput,
      });
      onDeleted(item);
      onClose();
    });
  }

  return (
    <SheetContent initialFocus={mode.kind === "add" ? nameRef : false}>
      <SheetTitle>{mode.kind === "add" ? "持ち物を追加" : "持ち物を編集"}</SheetTitle>
      <form className="sheet-form" onSubmit={(event) => void submit(event)}>
        <PhotoStrip
          saved={savedPhotos}
          drafts={drafts}
          onAdd={(files) =>
            setDrafts((current) => [
              ...current,
              ...files.map((file) => ({ id: crypto.randomUUID(), file })),
            ])
          }
          onRemoveSaved={(id) => setRemovedPhotos((current) => [...current, id])}
          onRemoveDraft={(id) =>
            setDrafts((current) => current.filter((candidate) => candidate.id !== id))
          }
        />
        <label className="field">
          <span className="field-label">名前</span>
          <Input
            ref={nameRef}
            value={draft.name}
            maxLength={120}
            enterKeyHint="next"
            required
            readOnly={busy}
            onChange={(event) => setField("name", event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">しまった場所</span>
          <Input
            value={draft.location}
            maxLength={80}
            enterKeyHint="next"
            placeholder="例: 玄関の棚"
            readOnly={busy}
            onChange={(event) => setField("location", event.target.value)}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field-label">カテゴリ</span>
            <Input
              value={draft.category}
              maxLength={40}
              enterKeyHint="next"
              readOnly={busy}
              onChange={(event) => setField("category", event.target.value)}
            />
          </label>
          <label className="field field-quantity">
            <span className="field-label">個数</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              step={1}
              required
              value={draft.quantity}
              readOnly={busy}
              onChange={(event) => setField("quantity", event.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span className="field-label">メモ</span>
          <Textarea
            value={draft.note}
            maxLength={1000}
            rows={2}
            readOnly={busy}
            onChange={(event) => setField("note", event.target.value)}
          />
        </label>
        {error && <ErrorNotice message={error} />}
        <SheetFooter>
          {mode.kind === "edit" && (
            <Button
              className="sheet-footer-start"
              variant="destructive"
              disabled={busy}
              onClick={() => remove(mode.item)}
            >
              削除
            </Button>
          )}
          <Button variant="outline" disabled={busy} onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={busy || !draft.name.trim()}>
            保存
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}
