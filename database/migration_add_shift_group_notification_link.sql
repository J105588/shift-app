-- ==========================================
-- マイグレーション: notificationsテーブルにshift_group_idを追加
-- ==========================================
-- 
-- 団体付与シフト（shift_groups）と通知を関連付けるため、shift_group_idカラムを追加します。

-- shift_group_idカラムを追加（NULL可）
alter table notifications
add column if not exists shift_group_id uuid references shift_groups(id) on delete cascade;

-- インデックスを追加（パフォーマンス向上のため）
create index if not exists idx_notifications_shift_group_id on notifications(shift_group_id);

