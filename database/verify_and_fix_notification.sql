-- ==========================================
-- 通知作成エラーの検証と修正
-- ==========================================
-- 
-- 現在のポリシー状態:
-- - "Admins can insert notifications" (管理者用)
-- - "Shift group participants can create chat notifications" (関数ベース)
-- 
-- このスクリプトで、関数の動作とデータを確認し、必要に応じて修正します。

-- ==========================================
-- 1. 関数の状態を確認
-- ==========================================

-- 関数が存在するか、その定義を確認
select 
  proname as function_name,
  prosecdef as is_security_definer,
  proargtypes::regtype[] as argument_types,
  prorettype::regtype as return_type,
  prosrc as function_body
from pg_proc 
where proname = 'is_shift_group_participant';

-- ==========================================
-- 2. 実際のデータを確認
-- ==========================================

-- シフトグループの参加者を確認
select 
  sa.id,
  sa.shift_group_id,
  sa.user_id,
  sa.is_supervisor,
  p.display_name,
  p.role,
  case 
    when sa.user_id = '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid then 'YES - このユーザーです'
    else 'NO'
  end as is_target_user
from shift_assignments sa
left join profiles p on p.id = sa.user_id
where sa.shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid
order by sa.created_at;

-- 特定のユーザーが参加者かどうかを確認
select 
  count(*) as assignment_count,
  case 
    when count(*) > 0 then 'YES - 参加者です'
    else 'NO - 参加者ではありません（これが問題の原因です）'
  end as is_participant
from shift_assignments
where shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid
and user_id = '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid;

-- ==========================================
-- 3. 関数を直接テスト
-- ==========================================

-- 関数を直接テスト（特定のユーザーIDで）
select 
  is_shift_group_participant(
    '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
    '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid
  ) as function_result,
  '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid as test_user_id,
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid as test_shift_group_id;

-- ==========================================
-- 4. 関数を再作成（security definerで確実に動作するように）
-- ==========================================

-- 注意: 関数を削除する前に、依存しているポリシーを削除する必要があります
-- ポリシーを一時的に削除
drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- 関数を削除して再作成
drop function if exists is_shift_group_participant(uuid, uuid);

-- security definerで関数を作成（より確実に動作）
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

-- 関数にコメントを追加
comment on function is_shift_group_participant(uuid, uuid) is 
  'ユーザーがシフトグループの参加者かどうかをチェック。security definer使用。';

-- ポリシーを再作成
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
-- 5. 関数を再テスト
-- ==========================================

-- 再作成後の関数をテスト
select 
  is_shift_group_participant(
    '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
    '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid
  ) as function_result_after_recreate;

-- ==========================================
-- 6. ユーザーが存在しない場合の対処
-- ==========================================

-- もし上記のクエリで「NO - 参加者ではありません」と表示された場合、
-- 以下のクエリでユーザーを追加してください（管理者権限が必要）:

-- 注意: このクエリは、ユーザーが実際に参加者であるべき場合にのみ実行してください
/*
insert into shift_assignments (shift_group_id, user_id, is_supervisor)
values (
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
  '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid,
  false
)
on conflict (shift_group_id, user_id) do update
set is_supervisor = excluded.is_supervisor;
*/

-- ==========================================
-- 7. ポリシーの再確認
-- ==========================================

-- ポリシーが正しく設定されているか再確認
select 
  policyname,
  cmd,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
and cmd = 'INSERT'
order by policyname;

