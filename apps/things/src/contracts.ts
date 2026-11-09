import { z } from "zod";

const itemId = z.uuid().brand<"ItemId">();
const name = z.string().trim().min(1).max(120);
const location = z.string().trim().max(80);
const category = z.string().trim().max(40);
const quantity = z.number().int().min(1).max(9999);
const note = z.string().trim().max(1000);

const photoId = z.uuid().brand<"PhotoId">();
const photoDimension = z.coerce.number().int().min(1).max(8000);

export const photoSchema = z.strictObject({
  id: photoId,
  width: photoDimension,
  height: photoDimension,
});

export const itemSchema = z.strictObject({
  id: itemId,
  name,
  location,
  category,
  quantity,
  note,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  photos: z.array(photoSchema),
});

export const searchItemsInput = {
  query: z.string().trim().max(100).default("").describe("空白区切りのAND検索。空なら最近の順"),
};
export const addItemInput = {
  requestId: z
    .uuid()
    .describe("書き込みごとに生成するUUID。結果が不明で再送するときは同じ値を使う"),
  name,
  location: location.default(""),
  category: category.default(""),
  quantity: quantity.default(1),
  note: note.default(""),
};
export const updateItemInput = {
  id: itemId,
  name: name.optional(),
  location: location.optional(),
  category: category.optional(),
  quantity: quantity.optional(),
  note: note.optional(),
};
export const setItemDeletedInput = { id: itemId, deleted: z.boolean() };

export const setPhotoDeletedInput = { id: photoId, deleted: z.boolean() };

export const photoLimits = { perItem: 12, fullBytes: 1_800_000, thumbBytes: 400_000 };
export const photoUploadForm = z.object({
  photoId,
  itemId,
  width: photoDimension,
  height: photoDimension,
  full: z.instanceof(File),
  thumb: z.instanceof(File),
});
export const photoRequest = z.object({ id: photoId, variant: z.enum(["full", "thumb"]) });
export const photoOutput = z.strictObject({ photo: photoSchema });

export const itemListOutput = z.strictObject({ items: z.array(itemSchema) });
export const itemOutput = z.strictObject({ item: itemSchema });
export const itemOptionsOutput = z.strictObject({
  locations: z.array(location),
  categories: z.array(category),
});
export const deletionOutput = z.strictObject({ deleted: z.boolean() });

export type Item = z.infer<typeof itemSchema>;
export type ItemOptions = z.infer<typeof itemOptionsOutput>;
export type ItemId = z.infer<typeof itemId>;
export type Photo = z.infer<typeof photoSchema>;
export type PhotoId = z.infer<typeof photoId>;
