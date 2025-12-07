-- ==========================================
-- マイグレーション: notificationsテーブルのRLSポリシー完全修正（最終版）
-- ==========================================
-- 
-- このバージョンでは、関数を使用せず、ポリシー内で直接サブクエリを使用します。
-- PostgreSQLのRLSポリシーでは、with check句内でカラム名を直接参照すると、
-- 挿入される行の値を参照します。
-- 
-- 注意: この方法は、PostgreSQLのバージョンによって動作が異なる場合があります。
-- もしこの方法でも動作しない場合は、関数ベースのアプローチ（v3）を使用してください。

-- ==========================================
-- 1. 既存のすべてのポリシーを削除
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
-- 2. ポリシーを再作成
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
-- 重要: with check句内でカラム名を直接参照すると、挿入される行の値を参照します
-- サブクエリ内では、shift_group_idを直接参照します（テーブル名なし）
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- shift_group_idが設定されている場合のみ
  shift_group_id is not null
  and
  -- そのシフトグループの参加者である
  -- 注意: with check句内では、カラム名を直接参照すると挿入される行の値を参照します
  exists (
    select 1 
    from shift_assignments sa
    where sa.shift_group_id = shift_group_id  -- 挿入される行のshift_group_idを参照
    and sa.user_id = auth.uid()
  )
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
-- 3. デバッグ用のクエリ
-- ==========================================
-- 
-- 以下のクエリをSupabase DashboardのSQL Editorで実行して、
-- 問題を診断してください:
-- 
-- 1. 現在のユーザーIDを確認:
--    select auth.uid() as current_user_id;
-- 
-- 2. シフトグループの参加者を確認:
--    select * 
--    from shift_assignments 
--    where shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid;
-- 
-- 3. 現在のユーザーがそのシフトグループの参加者かどうかを確認:
--    select * 
--    from shift_assignments 
--    where shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid
--    and user_id = auth.uid();
-- 
-- 4. ポリシーが正しく作成されているか確認:
--    select policyname, cmd, with_check
--    from pg_policies
--    where tablename = 'notifications'
--    and cmd = 'INSERT';
-- 
-- 5. テスト用のINSERT（実際には実行しない）:
--    -- このクエリは実行せず、with check句の評価を確認するためだけに使用
--    -- insert into notifications (target_user_id, title, body, scheduled_at, shift_group_id, created_by)
--    -- values (
--    --   '3a5b2d8d-9081-422a-80ea-9c6120f6701d'::uuid,
--    --   'test',
--    --   'test',
--    --   now(),
--    --   '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
--    --   auth.uid()
--    -- );

