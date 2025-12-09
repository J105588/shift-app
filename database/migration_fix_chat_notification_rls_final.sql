-- ==========================================
-- マイグレーション: チャット通知作成時のRLSポリシーエラー修正（最終版）
-- ==========================================
-- 
-- 問題: チャット機能で通知作成時にRLSポリシーエラー（403 Forbidden）が発生
-- 
-- 原因:
-- 1. is_shift_group_participant関数がsecurity invokerで定義されている可能性
-- 2. 関数が正しく作成されていない、または古い定義が残っている
-- 3. ポリシーが正しく適用されていない、または競合している
-- 
-- 解決策:
-- 1. is_shift_group_participant関数をsecurity definerで再作成（確実に動作）
-- 2. すべてのnotificationsテーブルのRLSポリシーを一度に削除して再作成
-- 3. 確実に動作するように、すべてのポリシーを正しい順序で再作成
--
-- 実行方法:
-- Supabase DashboardのSQL Editorでこのファイルの内容を実行してください

-- ==========================================
-- 1. 関数の再作成（security definer使用）
-- ==========================================

-- 既存の関数を削除（複数のシグネチャがある可能性があるため）
drop function if exists is_shift_group_participant(uuid, uuid);
drop function if exists is_shift_group_participant(uuid, uuid, boolean);

-- 関数を再作成（security definer使用）
-- security definerにより、関数の作成者（通常はpostgres）の権限で実行される
-- これにより、shift_assignmentsテーブルへのアクセスが確実に保証される
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
  'ユーザーがシフトグループの参加者かどうかをチェック。security definer使用により、RLSポリシーをバイパスして確実に動作します。';

-- ==========================================
-- 2. 既存のすべてのポリシーを削除
-- ==========================================

-- notificationsテーブルのすべてのポリシーを削除（競合を避けるため）
drop policy if exists "Admins manage notifications" on notifications;
drop policy if exists "Admins can view all notifications" on notifications;
drop policy if exists "Admins can insert notifications" on notifications;
drop policy if exists "Admins can update notifications" on notifications;
drop policy if exists "Admins can delete notifications" on notifications;
drop policy if exists "Users can view own notifications" on notifications;
drop policy if exists "Shift group participants can create chat notifications" on notifications;
drop policy if exists "Authenticated users can create chat notifications" on notifications;

-- ==========================================
-- 3. ポリシーを再作成（正しい順序で）
-- ==========================================

-- SELECTポリシー1: 管理者は全ての通知を閲覧可能
create policy "Admins can view all notifications"
on notifications
for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

-- SELECTポリシー2: ユーザーは自分宛の通知を閲覧可能
create policy "Users can view own notifications"
on notifications
for select
using (auth.uid() = target_user_id);

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
-- 関数ベースのアプローチを使用（security definer関数により確実に動作）
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- shift_group_idが設定されている場合のみ
  shift_group_id is not null
  and
  -- 認証されている
  auth.uid() is not null
  and
  -- そのシフトグループの参加者である（security definer関数を使用）
  is_shift_group_participant(shift_group_id, auth.uid())
);

-- UPDATEポリシー: 管理者は全ての通知を更新可能
create policy "Admins can update notifications"
on notifications
for update
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

-- DELETEポリシー: 管理者は全ての通知を削除可能
create policy "Admins can delete notifications"
on notifications
for delete
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

-- ==========================================
-- 4. 確認用クエリ
-- ==========================================

-- 関数が正しく作成されているか確認
select 
  proname,
  prosecdef,
  case 
    when prosecdef then 'security definer - OK'
    else 'security invoker - 問題あり'
  end as security_status
from pg_proc 
where proname = 'is_shift_group_participant';

-- ポリシーが正しく作成されているか確認
select 
  policyname,
  cmd,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
order by cmd, policyname;

-- ==========================================
-- 5. デバッグ用のテスト関数
-- ==========================================

-- テスト用: 現在のユーザーがシフトグループの参加者かどうかを確認
create or replace function test_is_participant(
  p_shift_group_id uuid
)
returns table(
  is_participant boolean,
  user_id uuid,
  shift_group_id uuid,
  assignment_count bigint
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    is_shift_group_participant(p_shift_group_id, auth.uid()) as is_participant,
    auth.uid() as user_id,
    p_shift_group_id as shift_group_id,
    (select count(*) from shift_assignments 
     where shift_group_id = p_shift_group_id 
     and user_id = auth.uid()) as assignment_count;
end;
$$;

-- ==========================================
-- 6. 使用方法とデバッグ方法
-- ==========================================
-- 
-- デバッグ方法:
-- 
-- 1. 現在のユーザーIDを確認:
--    select auth.uid() as current_user_id;
-- 
-- 2. 現在のユーザーのロールを確認:
--    select id, display_name, role from profiles where id = auth.uid();
-- 
-- 3. シフトグループの参加者を確認:
--    select * from shift_assignments 
--    where shift_group_id = 'シフトグループID'::uuid;
-- 
-- 4. 現在のユーザーがそのシフトグループの参加者かどうかを確認:
--    select * from test_is_participant('シフトグループID'::uuid);
-- 
-- 5. 関数を直接テスト:
--    select is_shift_group_participant('シフトグループID'::uuid, auth.uid()) as is_participant;
-- 
-- 6. ポリシーが正しく作成されているか確認:
--    select policyname, cmd, with_check 
--    from pg_policies 
--    where tablename = 'notifications' 
--    and cmd = 'INSERT';
-- 
-- トラブルシューティング:
-- 
-- もし403エラーが続く場合:
-- 1. 上記のデバッグクエリを実行して、ユーザーが実際にshift_assignmentsに存在するか確認
-- 2. auth.uid()が正しく返されているか確認
-- 3. shift_group_idが正しく設定されているか確認（通知作成時のpayloadを確認）
-- 4. 関数がsecurity definerで作成されているか確認（上記の確認クエリを実行）
-- 5. ポリシーが正しく作成されているか確認（上記の確認クエリを実行）

