-- 为 rules 表增加 plugins 字段，存储格式为 ,key1,key2, 便于 LIKE 匹配
ALTER TABLE rules ADD COLUMN IF NOT EXISTS plugins text;
