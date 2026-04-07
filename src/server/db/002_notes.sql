-- app_history に notes カラムを追加
-- 実行: wrangler d1 execute whisper-db --file src/server/db/002_notes.sql

ALTER TABLE app_history ADD COLUMN notes TEXT NOT NULL DEFAULT '';
