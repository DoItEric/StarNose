-- req031202: 删除 hot_words 字段，新增 attributes jsonb 字段
-- 适用于 data_items 和 data_items_abandon 两张表

-- data_items
ALTER TABLE data_items DROP COLUMN IF EXISTS hot_words;
ALTER TABLE data_items ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- data_items_abandon
ALTER TABLE data_items_abandon DROP COLUMN IF EXISTS hot_words;
ALTER TABLE data_items_abandon ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;
