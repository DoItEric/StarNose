-- 规则内容长度限制：超过该长度（字符数）则不做 LLM 匹配，直接忽略
ALTER TABLE rules ADD COLUMN IF NOT EXISTS content_length int;
