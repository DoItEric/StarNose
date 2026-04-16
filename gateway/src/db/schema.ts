import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  smallint,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * starnoseui 数据库 —— UI 专属表
 * 所有与交互相关的状态（阅读、跟踪、收藏等）都存储在这里，
 * 通过 data_item_id 引用 worker biz 库中的 data_items.id。
 */

export const uiReadStatus = pgTable(
  "ui_read_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataItemId: uuid("data_item_id").notNull(),
    status: smallint("status").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uq_ui_read_status_data_item").on(t.dataItemId)]
);

export const uiTracking = pgTable(
  "ui_tracking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataItemId: uuid("data_item_id").notNull(),
    sourceId: varchar("source_id", { length: 100 }).notNull(),
    uniqueKey: varchar("unique_key", { length: 500 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("uq_ui_tracking_data_item").on(t.dataItemId)]
);

export const uiFavoriteLists = pgTable("ui_favorite_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const uiFavorites = pgTable(
  "ui_favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataItemId: uuid("data_item_id").notNull(),
    listId: uuid("list_id").references(() => uiFavoriteLists.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_ui_favorites_data_item").on(t.dataItemId),
    index("ix_ui_favorites_list").on(t.listId),
  ]
);

export const uiDataMemo = pgTable(
  "ui_data_memo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataItemId: uuid("data_item_id").notNull(),
    memo: text("memo").notNull().default(""),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    extra: text("extra"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uq_ui_data_memo_data_item").on(t.dataItemId)]
);
