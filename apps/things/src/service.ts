import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { ToolNotFoundError } from "@pocket/tools/define-tool";
import { z } from "zod";
import { itemSchema, type Item, type ItemId, type PhotoId } from "./contracts";
import { thingsItems, thingsPhotos } from "./schema";

const itemLimit = 200;
const maxSearchTerms = 8;
const itemNotFound = "持ち物が見つかりません。";

type ItemFields = Pick<Item, "name" | "location" | "category" | "quantity" | "note">;

function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function termMatches(term: string) {
  const pattern = `%${escapeLike(term)}%`;
  return or(
    ...[thingsItems.name, thingsItems.location, thingsItems.category, thingsItems.note].map(
      (column) => sql`${column} LIKE ${pattern} ESCAPE '\\'`,
    ),
  );
}

export function createThingsService({
  binding,
  ownerId,
}: {
  binding: D1Database;
  ownerId: string;
}) {
  const database = drizzle(binding);
  const {
    ownerId: _owner,
    requestId: _request,
    deletedAt: _deleted,
    ...columns
  } = getTableColumns(thingsItems);
  const ownedItem = (id: ItemId) => and(eq(thingsItems.id, id), eq(thingsItems.ownerId, ownerId));

  function photosMatching(itemFilter: SQL) {
    return database
      .select({
        itemId: thingsPhotos.itemId,
        id: thingsPhotos.id,
        width: thingsPhotos.width,
        height: thingsPhotos.height,
      })
      .from(thingsPhotos)
      .where(and(eq(thingsPhotos.ownerId, ownerId), isNull(thingsPhotos.deletedAt), itemFilter))
      .orderBy(asc(thingsPhotos.createdAt), asc(thingsPhotos.id));
  }

  async function withPhotos<Row extends { id: string }>(row: Row) {
    const photos = await photosMatching(eq(thingsPhotos.itemId, row.id));
    return itemSchema.parse({
      ...row,
      photos: photos.map(({ itemId: _itemId, ...photo }) => photo),
    });
  }

  return {
    async search(query: string) {
      const terms = query.split(/\s+/u).filter(Boolean).slice(0, maxSearchTerms);
      const filter = and(
        eq(thingsItems.ownerId, ownerId),
        isNull(thingsItems.deletedAt),
        ...terms.map(termMatches),
      );
      const order = [desc(thingsItems.updatedAt), desc(thingsItems.id)];
      const rows = await database
        .select(columns)
        .from(thingsItems)
        .where(filter)
        .orderBy(...order)
        .limit(itemLimit);
      const matchedIds = database
        .select({ id: thingsItems.id })
        .from(thingsItems)
        .where(filter)
        .orderBy(...order)
        .limit(itemLimit);
      const photos = await photosMatching(inArray(thingsPhotos.itemId, matchedIds));
      const photosByItem = new Map<string, Omit<(typeof photos)[number], "itemId">[]>();
      for (const { itemId, ...photo } of photos)
        photosByItem.set(itemId, [...(photosByItem.get(itemId) ?? []), photo]);
      return z.array(itemSchema).parse(
        rows.map((row) => ({
          ...row,
          photos: photosByItem.get(row.id) ?? [],
        })),
      );
    },
    async add({ requestId, ...fields }: ItemFields & { requestId: string }) {
      const now = new Date().toISOString();
      const [inserted] = await database
        .insert(thingsItems)
        .values({
          ...fields,
          id: crypto.randomUUID(),
          ownerId,
          requestId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: [thingsItems.ownerId, thingsItems.requestId] })
        .returning(columns);
      if (inserted !== undefined) return withPhotos(inserted);
      const [existing] = await database
        .select(columns)
        .from(thingsItems)
        .where(and(eq(thingsItems.ownerId, ownerId), eq(thingsItems.requestId, requestId)));
      if (existing === undefined) throw new ToolNotFoundError(itemNotFound);
      return withPhotos(existing);
    },
    async update({ id, ...fields }: Partial<ItemFields> & { id: ItemId }) {
      const [row] = await database
        .update(thingsItems)
        .set({ ...fields, updatedAt: new Date().toISOString() })
        .where(and(ownedItem(id), isNull(thingsItems.deletedAt)))
        .returning(columns);
      if (row === undefined) throw new ToolNotFoundError(itemNotFound);
      return withPhotos(row);
    },
    async setDeleted({ id, deleted }: { id: ItemId; deleted: boolean }) {
      const rows = await database
        .update(thingsItems)
        .set({ deletedAt: deleted ? new Date().toISOString() : null })
        .where(ownedItem(id))
        .returning({ id: thingsItems.id });
      if (rows.length === 0) throw new ToolNotFoundError(itemNotFound);
      return { deleted };
    },
    async setPhotoDeleted({ id, deleted }: { id: PhotoId; deleted: boolean }) {
      const rows = await database
        .update(thingsPhotos)
        .set({ deletedAt: deleted ? new Date().toISOString() : null })
        .where(and(eq(thingsPhotos.id, id), eq(thingsPhotos.ownerId, ownerId)))
        .returning({ id: thingsPhotos.id });
      if (rows.length === 0) throw new ToolNotFoundError("写真が見つかりません。");
      return { deleted };
    },
  };
}

export type ThingsService = ReturnType<typeof createThingsService>;
