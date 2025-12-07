-- ==========================================
-- 最終確認とテスト
-- ==========================================
-- 
-- 関数はsecurity definerで正しく作成されています。
-- このスクリプトで、すべてが正しく動作するか最終確認します。

-- ==========================================
-- 1. 関数の動作確認
-- ==========================================

-- 関数が正しく動作するかテスト
select 
  is_shift_group_participant(
    '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
    '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid
  ) as function_result,
  '期待値: true' as expected,
  case 
    when is_shift_group_participant(
      '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
      '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid
    ) then '✓ 正常 - 関数はtrueを返します'
    else '✗ 異常 - 関数がfalseを返しています（データを確認してください）'
  end as status;

-- ==========================================
-- 2. データの再確認
-- ==========================================

-- ユーザーが実際にshift_assignmentsに存在するか確認
select 
  count(*) as assignment_count,
  case 
    when count(*) > 0 then '✓ データは存在します'
    else '✗ データが存在しません（これが問題の原因です）'
  end as data_status
from shift_assignments
where shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid
and user_id = '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid;

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
-- 4. ポリシーの評価順序の確認
-- ==========================================

-- PostgreSQLのRLSでは、複数のポリシーが存在する場合、
-- OR条件で評価されます。つまり、いずれかのポリシーがtrueを返せば、
-- 操作が許可されます。
-- 
-- 現在のポリシー:
-- 1. "Admins can insert notifications" - 管理者用
-- 2. "Shift group participants can create chat notifications" - 参加者用
-- 
-- どちらかがtrueを返せば、INSERTが許可されます。

-- ==========================================
-- 5. 実際のINSERTテスト（オプション）
-- ==========================================

-- 注意: このテストは実際にデータを挿入します
-- テスト後は削除してください
/*
-- テスト用のINSERT
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
  'テスト通知',
  'これはテストです',
  now(),
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
  '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid
)
returning id, created_at;

-- テスト後、作成された通知を削除
-- delete from notifications where title = 'テスト通知';
*/

-- ==========================================
-- 6. トラブルシューティング情報
-- ==========================================

-- もしまだ403エラーが発生する場合、以下を確認してください:
-- 
-- 1. 関数がtrueを返すか（ステップ1の結果）
-- 2. データが存在するか（ステップ2の結果）
-- 3. ポリシーが正しく作成されているか（ステップ3の結果）
-- 4. 現在のユーザーが正しく認証されているか（auth.uid()がnullでないか）
-- 5. shift_group_idが正しく設定されているか
-- 
-- 追加のデバッグ情報:
select 
  auth.uid() as current_user_id,
  (select role from profiles where id = auth.uid()) as current_user_role,
  (select count(*) from shift_assignments 
   where shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid
   and user_id = auth.uid()) as user_assignment_count;

