-- ==========================================
-- マイグレーション: アップデート通知テーブル app_updates を作成
-- ==========================================

create table if not exists app_updates (
  id uuid primary key default uuid_generate_v4(),
  version text not null,
  triggered_by uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table app_updates enable row level security;

-- 既存ポリシーがあれば削除
drop policy if exists "App updates are viewable by everyone" on app_updates;
drop policy if exists "Only admins can insert app updates" on app_updates;

-- 参照は全ユーザー可（端末側で更新チェックするため）
create policy "App updates are viewable by everyone"
on app_updates for select
using (true);

-- 追加は管理者のみ
create policy "Only admins can insert app updates"
on app_updates for insert
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

