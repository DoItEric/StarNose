CREATE TABLE IF NOT EXISTS "public"."favorite_items" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "data_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "favorite_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "favorite_items_data_id_key" UNIQUE ("data_id"),
  CONSTRAINT "favorite_items_data_id_fkey"
    FOREIGN KEY ("data_id")
    REFERENCES "public"."data_items"("id")
    ON DELETE CASCADE
);

COMMENT ON TABLE "public"."favorite_items" IS '用户收藏的数据项';
COMMENT ON COLUMN "public"."favorite_items"."data_id" IS '关联的 data_items.id';
COMMENT ON COLUMN "public"."favorite_items"."created_at" IS '收藏时间';

CREATE INDEX IF NOT EXISTS "favorite_items_created_at_idx"
  ON "public"."favorite_items" ("created_at" DESC);

