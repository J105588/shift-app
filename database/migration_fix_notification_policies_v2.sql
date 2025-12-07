-- ==========================================
-- マイグレーション: notificationsテーブルのRLSポリシー完全修正（v2）
-- ==========================================
-- 
-- 問題の再分析:
-- 1. 関数ベースのアプローチでも解決しない場合、security invokerが問題の可能性
-- 2. より確実な方法として、security definerを使用するか、直接ポリシー内でチェック
-- 3. デバッグ用の関数も追加して、実際の動作を確認できるようにする
-- 
-- 解決策:
-- 1. security definerを使用して関数を作成（より確実に動作）
-- 2. デバッグ用のログ関数を追加
-- 3. ポリシーを再構築

-- ==========================================
-- 1. デバッグ用関数（オプション、後で削除可能）
-- ==========================================

-- デバッグ用: ユーザーがシフトグループの参加者かどうかをチェック（ログ付き）
create or replace function debug_is_shift_group_participant(
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
  v_count integer;
begin
  -- shift_assignmentsテーブルから直接チェック
  select count(*) into v_count
  from shift_assignments
  where shift_group_id = p_shift_group_id
  and user_id = p_user_id;
  
  v_result := v_count > 0;
  
  -- デバッグ用（本番環境では削除推奨）
  -- raise notice 'debug_is_shift_group_participant: shift_group_id=%, user_id=%, count=%, result=%', 
  --   p_shift_group_id, p_user_id, v_count, v_result;
  
  return v_result;
end;
$$;

-- ==========================================
-- 2. メイン関数（security definer使用）
-- ==========================================

-- ユーザーがシフトグループの参加者かどうかをチェックする関数
-- security definerを使用することで、関数の作成者の権限で実行される
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
  -- shift_assignmentsテーブルは全員が閲覧可能だが、
  -- security definerを使用することで、より確実にアクセスできる
  return exists (
    select 1 from shift_assignments
    where shift_group_id = p_shift_group_id
    and user_id = p_user_id
  );
end;
$$;

-- 関数にコメントを追加
comment on function is_shift_group_participant(uuid, uuid) is 
  'ユーザーがシフトグループの参加者かどうかをチェックする関数。security definerを使用。';

-- ==========================================
-- 3. 既存のすべてのポリシーを削除
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
-- 4. 正しい順序でポリシーを再作成
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
-- security definer関数を使用することで、より確実に動作する
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
-- 5. テスト用のヘルパー関数（デバッグ用）
-- ==========================================

-- テスト用: 現在のユーザーがシフトグループの参加者かどうかを確認
-- Supabase DashboardのSQL Editorで実行してテスト可能
create or replace function test_shift_group_participant(
  p_shift_group_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  return is_shift_group_participant(p_shift_group_id, auth.uid());
end;
$$;

-- ==========================================
-- 6. ポリシーの確認用コメント
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
--     （security definer関数を使用）
-- 
-- UPDATE:
--   - 管理者: 全ての通知を更新可能
-- 
-- DELETE:
--   - 管理者: 全ての通知を削除可能
-- 
-- デバッグ方法:
-- 1. Supabase DashboardのSQL Editorで以下を実行:
--    select test_shift_group_participant('シフトグループID'::uuid);
-- 
-- 2. 関数が正しく動作しているか確認:
--    select is_shift_group_participant('シフトグループID'::uuid, auth.uid());
-- 
-- 3. shift_assignmentsテーブルを直接確認:
--    select * from shift_assignments where shift_group_id = 'シフトグループID'::uuid;

