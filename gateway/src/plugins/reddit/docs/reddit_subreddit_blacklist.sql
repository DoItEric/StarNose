CREATE TABLE IF NOT EXISTS "public"."reddit_subreddit_blacklist" (
  "name" text PRIMARY KEY
);

COMMENT ON TABLE "public"."reddit_subreddit_blacklist" IS '需要忽略的 subreddit 黑名单';
COMMENT ON COLUMN "public"."reddit_subreddit_blacklist"."name" IS 'subreddit 名称';

