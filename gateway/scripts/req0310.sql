-- 2026-03-10 req0310
-- 1) reddit 黑名单关联规则 + 白名单表
ALTER TABLE IF EXISTS reddit_subreddit_blacklist
  ADD COLUMN IF NOT EXISTS rule_id uuid NULL;

DO $$
BEGIN
  -- 若 rules 表存在则加外键；不存在时跳过，避免执行失败
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'rules'
  ) THEN
    BEGIN
      ALTER TABLE reddit_subreddit_blacklist
        ADD CONSTRAINT reddit_subreddit_blacklist_rule_id_fkey
        FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      -- ignore
    END;
  END IF;
END $$;

-- 规则维度唯一（忽略大小写）
CREATE UNIQUE INDEX IF NOT EXISTS reddit_subreddit_blacklist_rule_name_uidx
  ON reddit_subreddit_blacklist (rule_id, lower(name))
  WHERE rule_id IS NOT NULL;

-- 兼容旧数据：rule_id 为空时按全局唯一（忽略大小写）
CREATE UNIQUE INDEX IF NOT EXISTS reddit_subreddit_blacklist_global_name_uidx
  ON reddit_subreddit_blacklist (lower(name))
  WHERE rule_id IS NULL;

CREATE TABLE IF NOT EXISTS reddit_subreddit_whitelist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reddit_subreddit_whitelist_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'rules'
  ) THEN
    BEGIN
      ALTER TABLE reddit_subreddit_whitelist
        ADD CONSTRAINT reddit_subreddit_whitelist_rule_id_fkey
        FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      -- ignore
    END;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS reddit_subreddit_whitelist_rule_name_uidx
  ON reddit_subreddit_whitelist (rule_id, lower(name));

CREATE INDEX IF NOT EXISTS reddit_subreddit_whitelist_rule_id_idx
  ON reddit_subreddit_whitelist (rule_id);

-- 2) 抓取规则最小长度（rules.content_min_length）
ALTER TABLE IF EXISTS rules
  ADD COLUMN IF NOT EXISTS content_min_length int NULL;


-- 3) 收藏列表体系
CREATE TABLE IF NOT EXISTS favorite_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorite_lists_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS favorite_lists_name_uidx
  ON favorite_lists (lower(name));

-- 默认列表
INSERT INTO favorite_lists (name)
SELECT '默认'
WHERE NOT EXISTS (
  SELECT 1 FROM favorite_lists WHERE lower(name) = lower('默认')
);

ALTER TABLE IF EXISTS favorite_items
  ADD COLUMN IF NOT EXISTS list_id uuid NULL;

ALTER TABLE IF EXISTS favorite_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'favorite_lists'
  ) THEN
    BEGIN
      ALTER TABLE favorite_items
        ADD CONSTRAINT favorite_items_list_id_fkey
        FOREIGN KEY (list_id) REFERENCES favorite_lists(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
      -- ignore
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS favorite_items_list_id_idx
  ON favorite_items (list_id);

-- 4) params 字段（联系等自定义状态）
ALTER TABLE IF EXISTS data_items
  ADD COLUMN IF NOT EXISTS params jsonb NOT NULL DEFAULT '{}'::jsonb;
