-- ==========================================
-- 通知作成ポリシーの正しい修正
-- ==========================================
-- 
-- 問題: ポリシーのwith_check_clauseが間違っている
-- 現在: shift_assignments.shift_group_id = shift_assignments.shift_group_id (常にtrue)
-- 正しい: shift_assignments.shift_group_id = shift_group_id (挿入される行の値)
-- 
-- 解決策: 関数ベースのアプローチを使用（確実に動作）

-- ==========================================
-- 1. 関数が存在することを確認し、必要に応じて再作成
-- ==========================================

-- 関数が存在するか確認
select 
  proname,
  prosecdef,
  case 
    when prosecdef then 'security definer - OK'
    else 'security invoker - 問題の可能性'
  end as security_status
from pg_proc 
where proname = 'is_shift_group_participant';

-- 関数を再作成（確実に動作するように）
drop function if exists is_shift_group_participant(uuid, uuid);

create or replace function is_shift_group_participant(
  p_shift_group_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_result boolean;
begin
  -- shift_assignmentsテーブルから直接チェック
  -- security definerにより、RLSポリシーをバイパスしてアクセス可能
  select exists (
    select 1 
    from public.shift_assignments
    where shift_group_id = p_shift_group_id
    and user_id = p_user_id
  ) into v_result;
  
  -- nullの場合はfalseを返す
  return coalesce(v_result, false);
end;
$$;

-- 関数にコメントを追加
comment on function is_shift_group_participant(uuid, uuid) is 
  'ユーザーがシフトグループの参加者かどうかをチェック。security definer使用。';

-- ==========================================
-- 2. すべてのINSERTポリシーを削除
-- ==========================================

-- すべてのINSERTポリシーを削除（再作成のため）
drop policy if exists "Admins can insert notifications" on notifications;
drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- ==========================================
-- 3. ポリシーを再作成（関数ベース）
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
-- 関数ベースのアプローチを使用（確実に動作）
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- 基本的なチェック
  shift_group_id is not null
  and
  auth.uid() is not null
  and
  -- そのシフトグループの参加者である（security definer関数を使用）
  is_shift_group_participant(shift_group_id, auth.uid())
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
  ) as function_test_result,
  '期待値: true' as expected_result;

