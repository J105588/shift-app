-- ==========================================
-- 通知作成ポリシーの最終修正（直接サブクエリ方式）
-- ==========================================
-- 
-- 問題: 関数ベースのアプローチでも403エラーが発生する
-- 原因の可能性: 関数がポリシー評価時に正しく動作していない
-- 
-- 解決策: 関数に依存せず、ポリシー内で直接サブクエリを使用
-- PostgreSQLのRLSポリシーでは、with check句内でカラム名を直接参照すると、
-- 挿入される行の値を参照します。

-- ==========================================
-- 1. 既存のポリシーを削除
-- ==========================================

drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- ==========================================
-- 2. 直接サブクエリ方式でポリシーを再作成
-- ==========================================

-- 重要: with check句内でカラム名を直接参照すると、挿入される行の値を参照します
-- サブクエリ内では、shift_group_idを直接参照します（テーブル名なし）
-- これがPostgreSQLの標準的な動作です
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- shift_group_idが設定されている場合のみ
  shift_group_id is not null
  and
  -- 認証されていることを確認
  auth.uid() is not null
  and
  -- そのシフトグループの参加者である
  -- 注意: with check句内では、カラム名を直接参照すると挿入される行の値を参照します
  -- サブクエリ内で参照する場合、テーブル名を付けずに直接参照します
  exists (
    select 1 
    from shift_assignments
    where shift_assignments.shift_group_id = shift_group_id  -- 挿入される行のshift_group_idを参照
    and shift_assignments.user_id = auth.uid()
  )
);

-- ==========================================
-- 3. ポリシーの確認
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
-- 4. 注意事項
-- ==========================================
-- 
-- このポリシーでは、with check句内でshift_group_idを直接参照しています。
-- PostgreSQLのRLSポリシーでは、with check句内でカラム名を直接参照すると、
-- 挿入される行の値を参照します。
-- 
-- サブクエリ内で参照する場合、テーブル名を付けずに直接参照します。
-- これにより、挿入される行のshift_group_idの値が正しく参照されます。
-- 
-- もしこの方法でも動作しない場合、PostgreSQLのバージョンや設定に
-- 問題がある可能性があります。

