-- ==========================================
-- マイグレーション: push_subscriptions テーブルの修正
-- ==========================================

-- token カラムに UNIQUE 制約を追加（upsert で onConflict を使うため）
-- 既存の重複データがある場合は先に削除する必要があるかもしれません
alter table push_subscriptions
add constraint push_subscriptions_token_unique unique (token);

-- notifications テーブルに sent_at カラムを追加（送信済みフラグ用）
alter table notifications
add column if not exists sent_at timestamp with time zone;

-- sent_at 用のインデックスを追加（パフォーマンス向上のため）
create index if not exists idx_notifications_sent_at on notifications(sent_at);

-- scheduled_at 用のインデックスも追加（期限チェック用）
create index if not exists idx_notifications_scheduled_at on notifications(scheduled_at);

