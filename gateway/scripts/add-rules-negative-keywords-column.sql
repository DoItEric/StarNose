-- 为 rules 表增加 negative_keywords 字段：负面关键字，命中则忽略该条数据
-- 采用 text[]，与 keywords 一致
ALTER TABLE rules ADD COLUMN IF NOT EXISTS negative_keywords text[];

