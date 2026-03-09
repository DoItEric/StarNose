-- 阅读状态改为三态：0=未阅，1=已阅，-1=忽略
-- data_items
ALTER TABLE data_items ALTER COLUMN read DROP DEFAULT;
ALTER TABLE data_items ALTER COLUMN read TYPE smallint USING (CASE WHEN read = true THEN 1 ELSE 0 END);
ALTER TABLE data_items ALTER COLUMN read SET DEFAULT 0;

-- data_items_abandon
ALTER TABLE data_items_abandon ALTER COLUMN read DROP DEFAULT;
ALTER TABLE data_items_abandon ALTER COLUMN read TYPE smallint USING (CASE WHEN read = true THEN 1 ELSE 0 END);
ALTER TABLE data_items_abandon ALTER COLUMN read SET DEFAULT 0;
