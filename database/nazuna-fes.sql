-- ==========================================
-- 1. 下準備（UUID生成機能の有効化）
-- ==========================================
create extension if not exists "uuid-ossp";

-- ==========================================
-- 2. プロファイル（ユーザー情報）テーブル作成
-- ==========================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  -- roleは 'admin' か 'staff' しか入れられないように制限
  role text default 'staff' check (role in ('admin', 'staff')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS（セキュリティ）を有効化
alter table profiles enable row level security;

-- ポリシー設定
-- 1. 閲覧: 誰でも全員分の名前と役割を見れる（シフト表に名前を表示するため）
create policy "Profiles are viewable by everyone" 
on profiles for select 
using (true);

-- 2. 作成: ユーザーは自分のプロフィールだけ作成できる（新規登録時用）
create policy "Users can insert own profile" 
on profiles for insert 
with check (auth.uid() = id);

-- 3. 更新: ユーザーは自分のプロフィールだけ編集できる
create policy "Users can update own profile" 
on profiles for update 
using (auth.uid() = id);

-- ==========================================
-- 3. シフトテーブル作成
-- ==========================================
create table shifts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade, -- 誰のシフトか
  title text, -- 「受付」「休憩」などの内容
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS（セキュリティ）を有効化
alter table shifts enable row level security;

-- ポリシー設定
-- 1. 閲覧: 誰でもシフトを見れる
create policy "Shifts are viewable by everyone" 
on shifts for select 
using (true);

-- 2. 編集権限: 管理者(admin)だけが、追加・編集・削除すべて可能
-- 「操作しようとしている人のIDが、profilesテーブルでadminになっているか？」をチェック
create policy "Admins can manage all shifts" 
on shifts for all 
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role = 'admin'
  )
);