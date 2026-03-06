-- 通用数据入库表，供 Reddit / X / YouTube / 微博 / Instagram 等插件共用。
-- 字段抽象：主键、信息源主键、链接、标题、内容、评论数/点赞数（放 extra）、发布时间、入库时间、跟踪状态、更新时间、未读状态、插件源、匹配规则、其他属性（extra）。
-- 若已存在 data_items 表可跳过执行。

CREATE TABLE IF NOT EXISTS "public"."data_items" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "rule_id" uuid NOT NULL,
  "unique_key" varchar(500) NOT NULL,
  "source" varchar(100) NOT NULL,
  "title" text,
  "content" text,
  "url" text,
  "keywords" text[] NOT NULL DEFAULT '{}',
  "tracking" bool NOT NULL DEFAULT false,
  "crawl_time" timestamptz NOT NULL,
  "publish_time" timestamptz,
  "summary" text,
  "read" bool NOT NULL DEFAULT false,
  "remark" text,
  "heat_score" int4 NOT NULL DEFAULT 0,
  "extra" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "data_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "data_items_source_unique_key_key" UNIQUE ("source", "unique_key")
);

COMMENT ON COLUMN "public"."data_items"."unique_key" IS '信息源主键，如 Reddit post id、推文 id';
COMMENT ON COLUMN "public"."data_items"."source" IS '插件源/信息源，如 reddit、twitter';
COMMENT ON COLUMN "public"."data_items"."tracking" IS '用户跟踪状态';
COMMENT ON COLUMN "public"."data_items"."read" IS '未读状态，用户查看后更新';
COMMENT ON COLUMN "public"."data_items"."extra" IS '信息源扩展字段，如 comment_count、like_count、subreddit 等';
