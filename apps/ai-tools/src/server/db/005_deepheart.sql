-- DEEPHEART_DB マイグレーション 005: insights テーブル追加
-- 実行: wrangler d1 execute deepheart-db --file src/server/db/005_deepheart.sql

CREATE TABLE IF NOT EXISTS deepheart_insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES deepheart_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deepheart_insights_user_created ON deepheart_insights(user_id, created_at);
