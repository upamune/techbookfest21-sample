import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const thingsItems = sqliteTable(
  "things_items",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    requestId: text("request_id").notNull(),
    name: text("name").notNull(),
    location: text("location").notNull().default(""),
    category: text("category").notNull().default(""),
    quantity: integer("quantity").notNull().default(1),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("things_items_request").on(table.ownerId, table.requestId),
    index("things_items_owner").on(table.ownerId, table.updatedAt),
    check("things_item_name_length", sql`length(trim(${table.name})) BETWEEN 1 AND 120`),
    check("things_item_quantity", sql`${table.quantity} BETWEEN 1 AND 9999`),
  ],
);

export const thingsPhotos = sqliteTable(
  "things_photos",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    itemId: text("item_id")
      .notNull()
      .references(() => thingsItems.id),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [index("things_photos_item").on(table.itemId, table.createdAt)],
);
