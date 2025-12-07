-- ==========================================
-- マイグレーション: チャット通知作成ポリシーの修正
-- ==========================================
-- 
-- 問題: RLSポリシーでshift_group_idの参照方法が不適切で、
-- チャット通知の作成が403エラーになっている
-- 
-- 原因: PostgreSQLのRLSポリシーでは、with check句内のサブクエリで
-- カラム名を直接参照する場合、正しく解決されない場合があります。
-- 
-- 解決策: 関数を使用してポリシーを実装するか、
-- またはポリシーの条件を再構築します。
-- ここでは、より確実な方法として、関数を使用します。

-- ヘルパー関数を作成: ユーザーがシフトグループの参加者かどうかをチェック
-- security invokerを使用することで、関数は呼び出し元の権限で実行されます
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
  return exists (
    select 1 from shift_assignments
    where shift_group_id = p_shift_group_id
    and user_id = p_user_id
  );
end;
$$;

-- 既存のポリシーを削除
drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- 修正されたチャット通知作成ポリシー
-- 関数を使用することで、カラム参照の問題を回避します
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

