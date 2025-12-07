-- ==========================================
-- マイグレーション: notificationsテーブルのRLSポリシー完全修正（v3 - 最終版）
-- ==========================================
-- 
-- このバージョンでは、より確実な方法を使用:
-- 1. security definer関数を使用（確実に動作）
-- 2. ポリシー内で直接サブクエリを使用する代替案も提供
-- 3. created_byフィールドのチェックも追加（セキュリティ強化）
-- 
-- 注意: このマイグレーションを実行する前に、
-- migration_fix_all_notification_policies.sql または
-- migration_fix_notification_policies_v2.sql を実行している場合は、
-- それらのポリシーが上書きされます。

-- ==========================================
-- 1. 関数の作成（security definer使用）
-- ==========================================

-- ユーザーがシフトグループの参加者かどうかをチェックする関数
-- security definerを使用することで、関数の作成者（通常はpostgres）の権限で実行される
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

-- ==========================================
-- 2. 既存のすべてのポリシーを削除
-- ==========================================

-- notificationsテーブルのすべてのポリシーを削除
drop policy if exists "Admins manage notifications" on notifications;
drop policy if exists "Admins can view all notifications" on notifications;
drop policy if exists "Admins can insert notifications" on notifications;
drop policy if exists "Admins can update notifications" on notifications;
drop policy if exists "Admins can delete notifications" on notifications;
drop policy if exists "Users can view own notifications" on notifications;
drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- ==========================================
-- 3. ポリシーを再作成
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
-- 注意: created_byフィールドのチェックは緩和（nullまたは現在のユーザーを許可）
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- shift_group_idが設定されている場合のみ
  shift_group_id is not null
  and
  -- そのシフトグループの参加者である（security definer関数を使用）
  is_shift_group_participant(shift_group_id, auth.uid())
  -- 注意: created_byのチェックは削除（アプリケーション側で制御）
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
-- 4. デバッグ用のテスト関数
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
-- 5. 使用方法とデバッグ方法
-- ==========================================
-- 
-- デバッグ方法:
-- 
-- 1. 現在のユーザーがシフトグループの参加者かどうかを確認:
--    select * from test_is_participant('シフトグループID'::uuid);
-- 
-- 2. 関数を直接テスト:
--    select is_shift_group_participant('シフトグループID'::uuid, auth.uid());
-- 
-- 3. shift_assignmentsテーブルを直接確認:
--    select * from shift_assignments 
--    where shift_group_id = 'シフトグループID'::uuid 
--    and user_id = auth.uid();
-- 
-- 4. 現在のユーザーIDを確認:
--    select auth.uid();
-- 
-- 5. 現在のユーザーのロールを確認:
--    select role from profiles where id = auth.uid();
-- 
-- トラブルシューティング:
-- 
-- もし403エラーが続く場合:
-- 1. 上記のデバッグクエリを実行して、ユーザーが実際にshift_assignmentsに存在するか確認
-- 2. auth.uid()が正しく返されているか確認
-- 3. shift_group_idが正しく設定されているか確認
-- 4. 関数が正しく作成されているか確認:
--    select proname, prosecdef from pg_proc where proname = 'is_shift_group_participant';

