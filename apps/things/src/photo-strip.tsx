import { useEffect, useState, type ChangeEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { photoLimits, type Photo, type PhotoId } from "./contracts";
import { photoUrl, type DraftPhoto } from "./upload";

function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="photo-remove" aria-label={label} onClick={onRemove}>
      <X aria-hidden="true" />
    </button>
  );
}

function DraftTile({
  draft,
  position,
  onRemove,
}: {
  draft: DraftPhoto;
  position: number;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(draft.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.file]);
  return (
    <li className="photo-tile">
      {preview && <img src={preview} alt={`追加する写真 ${position}`} />}
      <RemoveButton label={`追加する写真 ${position}を外す`} onRemove={onRemove} />
    </li>
  );
}

export function PhotoStrip({
  saved,
  drafts,
  onAdd,
  onRemoveSaved,
  onRemoveDraft,
}: {
  saved: Photo[];
  drafts: DraftPhoto[];
  onAdd: (files: File[]) => void;
  onRemoveSaved: (id: PhotoId) => void;
  onRemoveDraft: (id: string) => void;
}) {
  const remaining = photoLimits.perItem - saved.length - drafts.length;
  function select(event: ChangeEvent<HTMLInputElement>) {
    onAdd([...(event.target.files ?? [])].slice(0, remaining));
    event.target.value = "";
  }
  return (
    <ul className="photo-strip" aria-label="写真">
      {saved.map((photo, index) => (
        <li key={photo.id} className="photo-tile">
          <img src={photoUrl(photo.id, "thumb")} alt={`写真 ${index + 1}`} decoding="async" />
          <RemoveButton
            label={`写真 ${index + 1}を削除`}
            onRemove={() => onRemoveSaved(photo.id)}
          />
        </li>
      ))}
      {drafts.map((draft, index) => (
        <DraftTile
          key={draft.id}
          draft={draft}
          position={index + 1}
          onRemove={() => onRemoveDraft(draft.id)}
        />
      ))}
      {remaining > 0 && (
        <li className="photo-tile photo-add">
          <ImagePlus aria-hidden="true" />
          <span>写真を追加</span>
          <input type="file" accept="image/*" multiple aria-label="写真を追加" onChange={select} />
        </li>
      )}
    </ul>
  );
}
