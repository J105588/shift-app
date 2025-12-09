-- ==========================================
-- 診断: チャット通知作成時のRLSポリシーエラー診断
-- ==========================================
-- 
-- このファイルを実行して、現在の状態を確認してください。
-- 問題の原因を特定するために使用します。

-- ==========================================
-- 1. 現在のユーザー情報を確認
-- ==========================================

select 
  auth.uid() as current_user_id,
  (select display_name from profiles where id = auth.uid()) as display_name,
  (select role from profiles where id = auth.uid()) as role;

-- ==========================================
-- 2. 関数の状態を確認
-- ==========================================

select 
  proname,
  prosecdef,
  prosrc,
  case 
    when prosecdef then 'security definer - OK'
    else 'security invoker - 問題の可能性'
  end as security_status
from pg_proc 
where proname = 'is_shift_group_participant';

-- ==========================================
-- 3. ポリシーの状態を確認
-- ==========================================

select 
  policyname,
  cmd,
  qual as using_clause,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
order by cmd, policyname;

-- ==========================================
-- 4. shift_assignmentsテーブルのRLSポリシーを確認
-- ==========================================

select 
  policyname,
  cmd,
  qual as using_clause,
  with_check as with_check_clause
from pg_policies
where tablename = 'shift_assignments'
order by cmd, policyname;

-- ==========================================
-- 5. テスト用: シフトグループIDを指定して確認
-- ==========================================
-- 
-- 以下のクエリで、実際のシフトグループIDを使用してテストしてください：
-- 
-- -- シフトグループIDを実際のIDに置き換えてください
-- -- 例: '017df965-3b84-48d1-af7f-86abb2d35807'::uuid
-- 
-- -- 5-1. シフトグループの参加者を確認
-- select * from shift_assignments 
-- where shift_group_id = '017df965-3b84-48d1-af7f-86abb2d35807'::uuid;
-- 
-- -- 5-2. 現在のユーザーがそのシフトグループの参加者かどうかを確認
-- select * from shift_assignments 
-- where shift_group_id = '017df965-3b84-48d1-af7f-86abb2d35807'::uuid
-- and user_id = auth.uid();
-- 
-- -- 5-3. 関数を直接テスト（関数が存在する場合）
-- select is_shift_group_participant(
--   '017df965-3b84-48d1-af7f-86abb2d35807'::uuid,
--   auth.uid()
-- ) as is_participant;
-- 
-- -- 5-4. テスト関数を使用（test_is_participant関数が存在する場合）
-- select * from test_is_participant('017df965-3b84-48d1-af7f-86abb2d35807'::uuid);
-- 
-- -- 5-5. ポリシーのwith_check句を手動で評価（テスト用）
-- -- このクエリは実際には実行しませんが、ポリシーの条件を確認するために使用します
-- select 
--   '017df965-3b84-48d1-af7f-86abb2d35807'::uuid as shift_group_id,
--   auth.uid() as user_id,
--   case 
--     when exists (
--       select 1 from shift_assignments sa
--       where sa.shift_group_id = '017df965-3b84-48d1-af7f-86abb2d35807'::uuid
--       and sa.user_id = auth.uid()
--     ) then '参加者である'
--     else '参加者ではない'
--   end as participant_status;

-- ==========================================
-- 6. 推奨される修正手順
-- ==========================================
-- 
-- 1. 上記の診断クエリを実行して、現在の状態を確認
-- 2. 関数がsecurity definerで作成されていない場合は、以下を実行:
--    - database/migration_fix_chat_notification_rls_final.sql
-- 3. 関数が正しく作成されているが、まだエラーが発生する場合は、以下を実行:
--    - database/migration_fix_chat_notification_rls_direct.sql（直接サブクエリ方式）
-- 4. それでも解決しない場合は、Supabaseのサポートに問い合わせるか、
--    一時的にRLSを無効化してテスト（本番環境では推奨されません）

