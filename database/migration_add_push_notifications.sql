-- ==========================================
-- マイグレーション: プッシュ通知用テーブル
-- ==========================================

-- 端末のPushトークン
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  token text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table push_subscriptions enable row level security;

drop policy if exists "Users manage own push_subscriptions" on push_subscriptions;

create policy "Users manage own push_subscriptions"
on push_subscriptions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 通知ジョブ（手動送信・自動送信用）
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  target_user_id uuid references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  scheduled_at timestamp with time zone, -- null の場合は即時
  created_by uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table notifications enable row level security;

drop policy if exists "Admins manage notifications" on notifications;
drop policy if exists "Users can view own notifications" on notifications;

-- 管理者のみ作成・編集・削除
create policy "Admins manage notifications"
on notifications
for all
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

-- ユーザーは自分宛の通知を参照可能（将来アプリ内表示に使える）
create policy "Users can view own notifications"
on notifications
for select
using (auth.uid() = target_user_id);


