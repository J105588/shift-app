-- ==========================================
-- マイグレーション: notificationsテーブルにshift_idを追加
-- ==========================================
-- 
-- シフトと通知を関連付けるため、shift_idカラムを追加します。
-- これにより、シフト更新・削除時に通知も自動的に更新・削除できます。

-- shift_idカラムを追加（NULL可、既存の通知はNULLのまま）
alter table notifications
add column if not exists shift_id uuid references shifts(id) on delete cascade;

-- インデックスを追加（パフォーマンス向上のため）
create index if not exists idx_notifications_shift_id on notifications(shift_id);

-- 既存の通知でshift_idがNULLのものは、手動で削除するか、そのままにしておく
-- （過去の通知は保持するため）

