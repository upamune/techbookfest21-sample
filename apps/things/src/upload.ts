import { request } from "@pocket/tools/request";
import { photoOutput, type ItemId } from "./contracts";
import { prepareImage } from "./image";

const uploadTimeout = 60_000;

export type DraftPhoto = { id: string; file: File };

export const photoUrl = (id: string, variant: "full" | "thumb") =>
  `/api/things/photos/${id}/${variant}`;

export async function uploadPhoto({ itemId, draft }: { itemId: ItemId; draft: DraftPhoto }) {
  const { full, thumb } = await prepareImage(draft.file);
  const form = new FormData();
  form.set("photoId", draft.id);
  form.set("itemId", itemId);
  form.set("width", String(full.width));
  form.set("height", String(full.height));
  form.set("full", full.blob, "full.jpg");
  form.set("thumb", thumb, "thumb.jpg");
  await request({
    path: "/api/things/photos",
    schema: photoOutput,
    init: { method: "POST", body: form },
    timeoutMs: uploadTimeout,
  });
}
