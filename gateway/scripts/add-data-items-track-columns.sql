-- 数据跟踪：JSON 存储各数据源的跟踪指标（如 Reddit 的 ups、num_comments）
ALTER TABLE data_items ADD COLUMN IF NOT EXISTS track_data jsonb DEFAULT '{}';
-- 最后一次 track 的时间
ALTER TABLE data_items ADD COLUMN IF NOT EXISTS last_track_at timestamptz;
-- 已 track 次数
ALTER TABLE data_items ADD COLUMN IF NOT EXISTS track_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN data_items.track_data IS '各数据源跟踪指标，如 reddit 的 ups、num_comments';
COMMENT ON COLUMN data_items.last_track_at IS '最后一次 track 时间';
COMMENT ON COLUMN data_items.track_count IS '已 track 次数';

-- data_items_abandon 同样增加跟踪字段便于展示
ALTER TABLE data_items_abandon ADD COLUMN IF NOT EXISTS track_data jsonb DEFAULT '{}';
ALTER TABLE data_items_abandon ADD COLUMN IF NOT EXISTS last_track_at timestamptz;
ALTER TABLE data_items_abandon ADD COLUMN IF NOT EXISTS track_count int NOT NULL DEFAULT 0;
