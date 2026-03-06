-- 规则筛选时使用的 prompt 文件名（不含扩展名），对应 prompts 目录下的文件
ALTER TABLE rules ADD COLUMN IF NOT EXISTS prompt_file text;
