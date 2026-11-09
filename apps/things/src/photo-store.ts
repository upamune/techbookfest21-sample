import { and, count, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { ToolNotFoundError } from "@pocket/tools/define-tool";
import {
  photoLimits,
  photoRequest,
  photoSchema,
  photoUploadForm,
  type ItemId,
  type PhotoSource,
} from "./contracts";
import { convertPhoto, loadPhotoBytes, PhotoRejectedError } from "./photo-input";
import { thingsItems, thingsPhotos } from "./schema";

const photoNotFound = "写真が見つかりません。";

async function jpegBytes(file: File, maxBytes: number) {
  if (file.size === 0 || file.size > maxBytes)
    throw new PhotoRejectedError("写真のサイズが上限を超えています。");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
    throw new PhotoRejectedError("JPEG形式の写真だけを保存できます。");
  return bytes;
}

export type PhotoStore = ReturnType<typeof createPhotoStore>;

export function createPhotoStore({
  binding,
  storage,
  images,
  ownerId,
}: {
  binding: D1Database;
  storage: R2Bucket;
  images?: ImagesBinding;
  ownerId: string;
}) {
  const database = drizzle(binding);
  const objectKey = (id: string, variant: "full" | "thumb") =>
    `things/${ownerId}/${id}/${variant}.jpg`;
  const httpMetadata = { contentType: "image/jpeg" };
  const ownedPhoto = (id: string) =>
    and(eq(thingsPhotos.id, id), eq(thingsPhotos.ownerId, ownerId));

  async function assertItemHasRoom(itemId: string) {
    const [item] = await database
      .select({ id: thingsItems.id })
      .from(thingsItems)
      .where(
        and(
          eq(thingsItems.id, itemId),
          eq(thingsItems.ownerId, ownerId),
          isNull(thingsItems.deletedAt),
        ),
      );
    if (item === undefined) throw new ToolNotFoundError("持ち物が見つかりません。");
    const [photos] = await database
      .select({ total: count() })
      .from(thingsPhotos)
      .where(
        and(
          eq(thingsPhotos.itemId, itemId),
          eq(thingsPhotos.ownerId, ownerId),
          isNull(thingsPhotos.deletedAt),
        ),
      );
    if ((photos?.total ?? 0) >= photoLimits.perItem)
      throw new PhotoRejectedError(`写真は1点につき${photoLimits.perItem}枚までです。`);
  }

  async function persist({
    id,
    itemId,
    width,
    height,
    full,
    thumb,
  }: {
    id: string;
    itemId: string;
    width: number;
    height: number;
    full: Uint8Array;
    thumb: Uint8Array;
  }) {
    await Promise.all([
      storage.put(objectKey(id, "full"), full, { httpMetadata }),
      storage.put(objectKey(id, "thumb"), thumb, { httpMetadata }),
    ]);
    const inserted = await database
      .insert(thingsPhotos)
      .values({ id, ownerId, itemId, width, height, createdAt: new Date().toISOString() })
      .onConflictDoNothing({ target: thingsPhotos.id })
      .returning({ id: thingsPhotos.id });
    if (inserted.length === 0) throw new PhotoRejectedError("写真を保存できませんでした。");
    return photoSchema.parse({ id, width, height });
  }

  return {
    async add({
      requestId,
      itemId,
      source,
    }: {
      requestId: string;
      itemId: ItemId;
      source: PhotoSource;
    }) {
      const [existing] = await database
        .select({ id: thingsPhotos.id, width: thingsPhotos.width, height: thingsPhotos.height })
        .from(thingsPhotos)
        .where(ownedPhoto(requestId));
      if (existing !== undefined) return photoSchema.parse(existing);
      await assertItemHasRoom(itemId);
      const converted = await convertPhoto(images, await loadPhotoBytes(source));
      return persist({ id: requestId, itemId, ...converted });
    },
    async save(form: FormData) {
      const input = photoUploadForm.parse(Object.fromEntries(form));
      const dimensions = { width: input.width, height: input.height };
      const [existing] = await database
        .select({ id: thingsPhotos.id })
        .from(thingsPhotos)
        .where(ownedPhoto(input.photoId));
      if (existing !== undefined) return photoSchema.parse({ id: existing.id, ...dimensions });
      await assertItemHasRoom(input.itemId);
      const [full, thumb] = await Promise.all([
        jpegBytes(input.full, photoLimits.fullBytes),
        jpegBytes(input.thumb, photoLimits.thumbBytes),
      ]);
      return persist({ id: input.photoId, itemId: input.itemId, ...dimensions, full, thumb });
    },
    async open(request: unknown) {
      const { id, variant } = photoRequest.parse(request);
      const [row] = await database
        .select({ id: thingsPhotos.id })
        .from(thingsPhotos)
        .where(and(ownedPhoto(id), isNull(thingsPhotos.deletedAt)));
      if (row === undefined) throw new ToolNotFoundError(photoNotFound);
      const object = await storage.get(objectKey(id, variant));
      if (object === null) throw new ToolNotFoundError(photoNotFound);
      return object;
    },
  };
}
