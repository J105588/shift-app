-- ==========================================
-- デバッグ用SQL: 通知作成エラーの原因を特定
-- ==========================================
-- 
-- このファイルのクエリをSupabase DashboardのSQL Editorで実行して、
-- 問題の原因を特定してください。
-- 
-- エラー情報:
-- - currentUserId: '787b27ed-5ef8-48ef-a93c-694c351137a2'
-- - shiftGroupId: '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'

-- ==========================================
-- 1. 基本情報の確認
-- ==========================================

-- 現在のユーザーIDを確認
select auth.uid() as current_user_id;

-- 現在のユーザーのプロフィール情報を確認
select id, display_name, role 
from profiles 
where id = auth.uid();

-- ==========================================
-- 2. シフトグループの参加者を確認
-- ==========================================

-- シフトグループの全参加者を確認
select 
  sa.id,
  sa.shift_group_id,
  sa.user_id,
  sa.is_supervisor,
  p.display_name,
  p.role
from shift_assignments sa
left join profiles p on p.id = sa.user_id
where sa.shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid
order by sa.created_at;

-- 現在のユーザーがそのシフトグループの参加者かどうかを確認
select 
  sa.id,
  sa.shift_group_id,
  sa.user_id,
  sa.is_supervisor,
  case 
    when sa.user_id = auth.uid() then 'YES - 参加者です'
    else 'NO - 参加者ではありません'
  end as is_participant
from shift_assignments sa
where sa.shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid
and sa.user_id = auth.uid();

-- 参加者の数を確認
select 
  count(*) as total_participants,
  count(case when user_id = auth.uid() then 1 end) as current_user_is_participant
from shift_assignments
where shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid;

-- ==========================================
-- 3. 関数の確認（v3マイグレーションを実行した場合）
-- ==========================================

-- 関数が存在するか確認
select 
  proname,
  prosecdef,
  proargtypes::regtype[] as arg_types,
  prorettype::regtype as return_type
from pg_proc 
where proname = 'is_shift_group_participant';

-- 関数を直接テスト
select 
  is_shift_group_participant(
    '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
    '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid
  ) as function_result,
  '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid as test_user_id,
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid as test_shift_group_id;

-- 現在のユーザーで関数をテスト
select 
  is_shift_group_participant(
    '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
    auth.uid()
  ) as function_result_with_current_user;

-- ==========================================
-- 4. 現在のRLSポリシーを確認
-- ==========================================

-- notificationsテーブルのすべてのポリシーを確認
select 
  policyname,
  cmd,
  permissive,
  roles,
  qual as using_clause,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
order by cmd, policyname;

-- INSERTポリシーの詳細を確認
select 
  policyname,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
and cmd = 'INSERT';

-- ==========================================
-- 5. テスト用のINSERT（実際には実行しない）
-- ==========================================

-- 以下のクエリは実行せず、with check句の評価を確認するためだけに使用
-- 実際のデータでテストする場合は、コメントを外して実行してください
/*
insert into notifications (
  target_user_id, 
  title, 
  body, 
  scheduled_at, 
  shift_group_id, 
  created_by
)
values (
  '3a5b2d8d-9081-422a-80ea-9c6120f6701d'::uuid,
  'test',
  'test',
  now(),
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
  auth.uid()
);
*/

-- ==========================================
-- 6. 手動でshift_assignmentsを確認・修正
-- ==========================================

-- もし現在のユーザーがshift_assignmentsに存在しない場合、
-- 以下のクエリで追加できます（管理者権限が必要）:
/*
insert into shift_assignments (shift_group_id, user_id, is_supervisor)
values (
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
  '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid,
  false
)
on conflict (shift_group_id, user_id) do nothing;
*/

