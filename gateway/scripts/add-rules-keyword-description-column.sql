-- 关键字需求描述，用于生成/补充关键词；description 保留为信息偏好（LLM 匹配）
ALTER TABLE rules ADD COLUMN IF NOT EXISTS keyword_description text;
