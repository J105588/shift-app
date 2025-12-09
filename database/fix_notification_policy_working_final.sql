-- ==========================================
-- 通知作成ポリシーの最終修正（確実に動作する版）
-- ==========================================
-- 
-- 問題: 関数はtrueを返すが、まだ403エラーが発生する
-- 原因の可能性: 
-- 1. ポリシー評価時のタイミングの問題
-- 2. 複数のレコードを一度に挿入する際の問題
-- 3. SupabaseのRLSポリシー評価の問題
-- 
-- 解決策: 
-- 1. ポリシーを完全に再構築
-- 2. より単純で確実な条件を使用
-- 3. 関数を再確認

-- ==========================================
-- 1. すべてのINSERTポリシーを削除
-- ==========================================

-- すべてのINSERTポリシーを削除（再作成のため）
drop policy if exists "Admins can insert notifications" on notifications;
drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- ==========================================
-- 2. 関数を確認・再作成
-- ==========================================

-- 関数を削除（ポリシーが既に削除されているので、エラーにならない）
drop function if exists is_shift_group_participant(uuid, uuid);

-- security definerで関数を作成
create or replace function is_shift_group_participant(
  p_shift_group_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
stable
as $$
begin
  -- shift_assignmentsテーブルから直接チェック
  -- security definerにより、RLSポリシーをバイパスしてアクセス可能
  return exists (
    select 1 
    from public.shift_assignments
    where shift_group_id = p_shift_group_id
    and user_id = p_user_id
  );
end;
$$;

-- ==========================================
-- 3. ポリシーを再作成（より単純な条件で）
-- ==========================================

-- INSERTポリシー1: 管理者は全ての通知を作成可能
create policy "Admins can insert notifications"
on notifications
for insert
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

-- INSERTポリシー2: シフトグループの参加者はチャット通知を作成可能
-- 関数ベースのアプローチを使用
-- 条件を簡略化して、確実に動作するようにする
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  shift_group_id is not null
  and
  auth.uid() is not null
  and
  is_shift_group_participant(shift_group_id, auth.uid()) = true
);

-- ==========================================
-- 4. ポリシーの確認
-- ==========================================

-- すべてのINSERTポリシーを確認
select 
  policyname,
  cmd,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
and cmd = 'INSERT'
order by policyname;

-- ==========================================
-- 5. 関数のテスト
-- ==========================================

-- 関数が正しく動作するかテスト
select 
  is_shift_group_participant(
    '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
    '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid
  ) as function_result,
  '期待値: true' as expected;


