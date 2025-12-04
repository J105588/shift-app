-- ==========================================
-- マイグレーション: システム設定テーブル app_settings を作成
-- ==========================================

create table if not exists app_settings (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  value text not null,
  description text,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table app_settings enable row level security;

-- 既存ポリシーがあれば削除
drop policy if exists "Settings are viewable by everyone" on app_settings;
drop policy if exists "Only admins can manage settings" on app_settings;

-- 参照は全ユーザー可（メンテナンスモードチェックなどで使用）
create policy "Settings are viewable by everyone"
on app_settings for select
using (true);

-- 編集は管理者のみ
create policy "Only admins can manage settings"
on app_settings for all
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

-- 初期設定: メンテナンスモードをオフにする
insert into app_settings (key, value, description)
values ('maintenance_mode', 'false', 'システムメンテナンスモード（true/false）')
on conflict (key) do nothing;

