-- ==========================================
-- マイグレーション: user_emailsテーブルの作成とトリガーの更新
-- 目的: 一般ユーザーへのメールアドレス露出を防ぐ（セキュリティ強化）と、
--       APIでのメールアドレス結合処理の高速化（N+1および全ユーザー取得ループの廃止）
-- ==========================================

-- 1. user_emails テーブルを作成 (管理者と本人のみがアクセス可能なセキュアなテーブル)
create table if not exists public.user_emails (
  id uuid references public.profiles(id) on delete cascade primary key,
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS（行レベルセキュリティ）を有効化
alter table public.user_emails enable row level security;

-- インデックスを追加して検索を高速化
create index if not exists idx_user_emails_email on public.user_emails(email);

-- 2. RLSポリシーの設定 (閲覧は本人または管理者のみ)
drop policy if exists "Emails are viewable by owner and admins" on public.user_emails;
create policy "Emails are viewable by owner and admins"
on public.user_emails for select
using (
  auth.uid() = id
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);

-- 3. 新規ユーザー作成時・更新時のトリガー関数をアップデート
create or replace function public.handle_new_user() 
returns trigger as $$
declare
  v_display_name text;
begin
  -- user_metadataからdisplay_nameまたはfull_nameを取得
  v_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.email  -- フォールバック
  );
  
  -- 3-1. プロフィールが既に存在する場合は更新、存在しない場合は作成
  insert into public.profiles (id, display_name, role)
  values (new.id, v_display_name, 'staff')
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, profiles.display_name);
  
  -- 3-2. メールアドレス情報の保存（user_emailsテーブル）
  insert into public.user_emails (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email;
  
  return new;
end;
$$ language plpgsql security definer;

-- 既存のトリガーを削除して再作成（after insert）
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- メールアドレス更新に対応するトリガーも設定（after update of email）
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. 既存の auth.users から user_emails への移行バッチ
-- 外部キー制約エラーを防ぐため、まず profiles に欠損しているユーザーレコードを作成
insert into public.profiles (id, display_name, role)
select 
  u.id, 
  coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.email),
  'staff'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- その後、profilesに存在するレコードのみを user_emails に移行
insert into public.user_emails (id, email)
select u.id, u.email 
from auth.users u
join public.profiles p on p.id = u.id
on conflict (id) do update set email = excluded.email;
