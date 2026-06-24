-- ==========================================
-- マイグレーション: 検索およびソートのパフォーマンス最適化のためのインデックス追加
-- ==========================================

-- 1. shiftsテーブルのインデックス追加
create index if not exists idx_shifts_user_id on shifts(user_id);
create index if not exists idx_shifts_start_time on shifts(start_time);
create index if not exists idx_shifts_end_time on shifts(end_time);

-- 2. profilesテーブルのインデックス追加
create index if not exists idx_profiles_display_name on profiles(display_name);
create index if not exists idx_profiles_created_at on profiles(created_at);

-- 3. push_subscriptionsテーブルのインデックス追加
create index if not exists idx_push_subscriptions_user_created on push_subscriptions(user_id, created_at desc);

-- 4. notificationsテーブルのインデックス追加
create index if not exists idx_notifications_unsent on notifications(scheduled_at) where sent_at is null;
create index if not exists idx_notifications_target_user_id on notifications(target_user_id);
