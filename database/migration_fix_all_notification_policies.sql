-- ==========================================
-- マイグレーション: notificationsテーブルのRLSポリシー完全修正
-- ==========================================
-- 
-- 問題の分析:
-- 1. notificationsテーブルのRLSポリシーが複数のマイグレーションで段階的に変更されている
-- 2. チャット通知作成時に403エラーが発生している
-- 3. ポリシーの競合や不完全な適用の可能性がある
-- 
-- 解決策:
-- 1. すべてのnotificationsテーブルのポリシーを一度に削除
-- 2. 正しい順序でポリシーを再作成
-- 3. 関数ベースのアプローチでチャット通知作成ポリシーを実装

-- ==========================================
-- 1. ヘルパー関数の作成（既存の場合は置き換え）
-- ==========================================

-- ユーザーがシフトグループの参加者かどうかをチェックする関数
create or replace function is_shift_group_participant(
  p_shift_group_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security invoker
stable
as $$
begin
  -- shift_assignmentsテーブルは全員が閲覧可能なので、この関数は正常に動作する
  return exists (
    select 1 from shift_assignments
    where shift_group_id = p_shift_group_id
    and user_id = p_user_id
  );
end;
$$;

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
-- 3. 正しい順序でポリシーを再作成
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
-- 関数を使用することで、カラム参照の問題を回避
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- shift_group_idが設定されている場合のみ
  shift_group_id is not null
  and
  -- そのシフトグループの参加者である（関数を使用）
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
-- 4. ポリシーの確認用コメント
-- ==========================================
-- 
-- 現在のnotificationsテーブルのRLSポリシー構成:
-- 
-- SELECT (OR条件で評価):
--   - 管理者: 全ての通知を閲覧可能
--   - ユーザー: 自分宛の通知のみ閲覧可能
-- 
-- INSERT (OR条件で評価):
--   - 管理者: 全ての通知を作成可能
--   - シフトグループ参加者: shift_group_idが設定されたチャット通知を作成可能
-- 
-- UPDATE:
--   - 管理者: 全ての通知を更新可能
-- 
-- DELETE:
--   - 管理者: 全ての通知を削除可能
-- 
-- 注意: PostgreSQLのRLSでは、複数のポリシーが存在する場合、
-- OR条件で評価されます。つまり、いずれかのポリシーがtrueを返せば、
-- 操作が許可されます。

