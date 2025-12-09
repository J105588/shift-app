-- ==========================================
-- 通知作成ポリシーの最終修正（確実に動作する版）
-- ==========================================
-- 
-- 問題: すべてのデバッグ情報が正常なのに、まだ403エラーが発生する
-- 原因の可能性: 
-- 1. 複数のレコードを一度に挿入する際の問題
-- 2. ポリシーの評価順序の問題
-- 3. PostgreSQLのRLSポリシー評価の問題
-- 
-- 解決策: 
-- 1. すべてのポリシーを一度に削除して再作成
-- 2. より単純で確実なポリシーを使用
-- 3. 関数ベースと直接サブクエリ方式の両方を試す

-- ==========================================
-- 1. すべてのINSERTポリシーを削除
-- ==========================================

-- すべてのINSERTポリシーを削除（再作成のため）
drop policy if exists "Admins can insert notifications" on notifications;
drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- ==========================================
-- 2. ポリシーを再作成（確実に動作する順序で）
-- ==========================================

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
-- 関数ベースのアプローチを使用（より確実に動作）
-- 注意: 直接サブクエリ方式では、PostgreSQLが正しくカラム参照を解決できない場合がある
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- 基本的なチェック
  shift_group_id is not null
  and
  auth.uid() is not null
  and
  -- そのシフトグループの参加者である（security definer関数を使用）
  -- 関数を使用することで、カラム参照の問題を回避
  is_shift_group_participant(shift_group_id, auth.uid())
);

-- ==========================================
-- 3. ポリシーの確認
-- ==========================================

-- すべてのINSERTポリシーを確認
select 
  policyname,
  cmd,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
and cmd = 'INSERT'
order by policyname;

-- ==========================================
-- 4. 追加のデバッグ: ポリシーの評価をテスト
-- ==========================================

-- 注意: このテストはSupabase DashboardのSQL Editorでは実行できません
-- （auth.uid()がnullになるため）
-- 実際のアプリケーションでテストする必要があります

-- テスト用のクエリ（コメントアウト）:
/*
-- テスト1: 単一レコードの挿入
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
  'テスト通知1',
  'これはテストです',
  now(),
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
  auth.uid()
)
returning id;

-- テスト2: 複数レコードの挿入（実際のアプリケーションで使用される方法）
insert into notifications (
  target_user_id, 
  title, 
  body, 
  scheduled_at, 
  shift_group_id, 
  created_by
)
values 
  (
    '3a5b2d8d-9081-422a-80ea-9c6120f6701d'::uuid,
    'テスト通知1',
    'これはテストです',
    now(),
    '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
    auth.uid()
  ),
  (
    '別のユーザーID'::uuid,  -- 実際のユーザーIDに置き換え
    'テスト通知2',
    'これはテストです',
    now(),
    '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
    auth.uid()
  )
returning id;
*/

-- ==========================================
-- 5. トラブルシューティング
-- ==========================================
-- 
-- もしまだ403エラーが発生する場合、以下を確認してください:
-- 
-- 1. ポリシーが正しく作成されているか（ステップ3の結果を確認）
-- 2. 複数のレコードを一度に挿入する場合、すべてのレコードが同じ条件を満たす必要があります
-- 3. target_user_idが異なるレコードでも、shift_group_idとauth.uid()は同じである必要があります
-- 
-- 追加の確認:
-- - アプリケーション側で、1つずつレコードを挿入してみる（複数レコードの問題を特定）
-- - ポリシーのwith_check句が正しく評価されているか確認

