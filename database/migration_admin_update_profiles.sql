-- ==========================================
-- マイグレーション: 管理者が他のユーザーのプロフィールを編集できるようにRLSポリシーを追加
-- ==========================================

-- 既存のポリシーを削除（存在する場合）
drop policy if exists "Users can update own profile" on profiles;

-- 更新ポリシー: ユーザーは自分のプロフィールを編集できる
create policy "Users can update own profile" 
on profiles for update 
using (auth.uid() = id);

-- 更新ポリシー: 管理者は全ユーザーのプロフィールを編集できる
create policy "Admins can update all profiles" 
on profiles for update 
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role = 'admin'
  )
);

