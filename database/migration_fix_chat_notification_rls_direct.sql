-- ==========================================
-- マイグレーション: チャット通知作成時のRLSポリシーエラー修正（直接サブクエリ方式）
-- ==========================================
-- 
-- 問題: 関数ベースのアプローチでも403エラーが発生する
-- 
-- 原因の可能性:
-- 1. SupabaseのRLSポリシー評価で関数が正しく評価されていない
-- 2. 関数の実行コンテキストの問題
-- 
-- 解決策:
-- ポリシー内で直接サブクエリを使用（shift_assignmentsは全員が閲覧可能なので可能）
-- PostgreSQLのRLSポリシーでは、with check句内でカラム名を直接参照すると、
-- 挿入される行の値を参照します。
--
-- 実行方法:
-- Supabase DashboardのSQL Editorでこのファイルの内容を実行してください

-- ==========================================
-- 1. 既存のINSERTポリシーを削除
-- ==========================================

-- チャット通知作成ポリシーを削除
drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- ==========================================
-- 2. 直接サブクエリ方式でポリシーを再作成
-- ==========================================

-- INSERTポリシー: シフトグループの参加者はチャット通知を作成可能
-- 重要: with check句内でカラム名を直接参照すると、挿入される行の値を参照します
-- サブクエリ内では、shift_group_idを直接参照します（テーブル名なし）
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
  -- そのシフトグループの参加者である（直接サブクエリを使用）
  -- 注意: with check句内では、カラム名を直接参照すると挿入される行の値を参照します
  exists (
    select 1 
    from shift_assignments sa
    where sa.shift_group_id = shift_group_id  -- 挿入される行のshift_group_idを参照
    and sa.user_id = auth.uid()
  )
);

-- ==========================================
-- 3. 確認用クエリ
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
-- 4. テスト方法
-- ==========================================
-- 
-- 以下のクエリでポリシーが正しく動作するかテストできます：
-- 
-- 1. 現在のユーザーIDを確認:
--    select auth.uid() as current_user_id;
-- 
-- 2. シフトグループの参加者を確認:
--    select * from shift_assignments 
--    where shift_group_id = 'シフトグループID'::uuid;
-- 
-- 3. 現在のユーザーがそのシフトグループの参加者かどうかを確認:
--    select * from shift_assignments 
--    where shift_group_id = 'シフトグループID'::uuid
--    and user_id = auth.uid();
-- 
-- 4. ポリシーのwith_check句を確認:
--    select with_check 
--    from pg_policies 
--    where tablename = 'notifications' 
--    and policyname = 'Shift group participants can create chat notifications';
-- 
-- 注意: この方法は、shift_assignmentsテーブルが全員が閲覧可能である必要があります。
-- もしshift_assignmentsテーブルにRLSポリシーが設定されていて、全員が閲覧できない場合は、
-- この方法は動作しません。その場合は、security definer関数を使用する必要があります。

--
-- このマイグレーションを実行する前に、以下を確認してください:
-- 1. shift_assignmentsテーブルが全員が閲覧可能であること（SELECTポリシーがusing (true)であること）
-- 2. 現在のユーザーがshift_assignmentsテーブルにアクセスできること
--
-- 確認方法:
-- select * from pg_policies where tablename = 'shift_assignments' and cmd = 'SELECT';
