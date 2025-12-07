-- ==========================================
-- 通知作成ポリシーの直接修正（関数なし）
-- ==========================================
-- 
-- データと関数は正常に動作しているが、まだ403エラーが発生する場合、
-- 関数に依存しない直接サブクエリ方式に切り替えます。
-- 
-- この方法では、ポリシー内で直接shift_assignmentsテーブルを参照します。

-- ==========================================
-- 1. 既存のポリシーを削除
-- ==========================================

-- チャット通知作成ポリシーを削除
drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- ==========================================
-- 2. 直接サブクエリ方式でポリシーを再作成
-- ==========================================

-- 重要: with check句内でカラム名を直接参照すると、挿入される行の値を参照します
-- しかし、サブクエリ内では正しく解決されない場合があるため、
-- より明示的な方法を使用します
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- shift_group_idが設定されている場合のみ
  shift_group_id is not null
  and
  -- そのシフトグループの参加者である
  -- 注意: notifications.shift_group_idを明示的に参照する必要がある場合がありますが、
  -- with check句内では、カラム名を直接参照すると挿入される行の値を参照します
  -- サブクエリ内で参照する場合は、テーブル名を付けずに直接参照します
  exists (
    select 1 
    from shift_assignments
    where shift_assignments.shift_group_id = notifications.shift_group_id
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
-- 4. テスト用のクエリ（実際には実行しない）
-- ==========================================

-- 以下のクエリで、ポリシーが正しく評価されるかテストできます
-- 実際のデータでテストする場合は、コメントを外して実行してください
/*
-- テスト1: 正しいshift_group_idとuser_idでテスト
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
  'test',
  'test',
  now(),
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
  auth.uid()
);

-- テスト2: 間違ったshift_group_idでテスト（エラーになるはず）
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
  'test',
  'test',
  now(),
  '00000000-0000-0000-0000-000000000000'::uuid,  -- 存在しないshift_group_id
  auth.uid()
);
*/

