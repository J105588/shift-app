-- ==========================================
-- 通知作成ポリシーの最終修正（確実に動作する版）
-- ==========================================
-- 
-- 問題: サブクエリ内でカラム参照が正しく解決されない
-- 解決策: security definer関数を使用し、関数内で確実に動作するようにする

-- ==========================================
-- 1. 既存のポリシーを削除
-- ==========================================

drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- ==========================================
-- 2. 関数を再作成（確実に動作するように）
-- ==========================================

-- 関数を削除（ポリシーが既に削除されているので、エラーにならない）
drop function if exists is_shift_group_participant(uuid, uuid);

-- security definerで関数を作成
-- この関数は、shift_assignmentsテーブルに直接アクセスし、
-- ユーザーがシフトグループの参加者かどうかをチェックします
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
  
  return coalesce(v_result, false);
end;
$$;

-- 関数にコメントを追加
comment on function is_shift_group_participant(uuid, uuid) is 
  'ユーザーがシフトグループの参加者かどうかをチェック。security definer使用。';

-- ==========================================
-- 3. ポリシーを再作成
-- ==========================================

-- 関数を使用してポリシーを作成
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- shift_group_idが設定されている場合のみ
  shift_group_id is not null
  and
  -- そのシフトグループの参加者である（security definer関数を使用）
  is_shift_group_participant(shift_group_id, auth.uid())
);

-- ==========================================
-- 4. 関数をテスト
-- ==========================================

-- 関数が正しく動作するかテスト
select 
  is_shift_group_participant(
    '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
    '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid
  ) as function_test_result,
  '期待値: true' as expected_result;

-- ==========================================
-- 5. ポリシーの確認
-- ==========================================

-- ポリシーが正しく作成されているか確認
select 
  policyname,
  cmd,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
and cmd = 'INSERT'
order by policyname;

-- ==========================================
-- 6. 関数の詳細確認
-- ==========================================

-- 関数がsecurity definerで作成されているか確認
select 
  proname as function_name,
  prosecdef as is_security_definer,
  case 
    when prosecdef then 'YES - security definer（正しい）'
    else 'NO - security invoker（問題の可能性）'
  end as security_status
from pg_proc 
where proname = 'is_shift_group_participant';

