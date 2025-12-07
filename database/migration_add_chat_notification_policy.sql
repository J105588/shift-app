-- ==========================================
-- マイグレーション: チャット通知作成ポリシー
-- ==========================================
-- 
-- チャット通知（shift_group_idが設定されている通知）は、
-- そのシフトグループの参加者が作成できるようにする

-- チャット通知作成ポリシー: シフトグループの参加者はチャット通知を作成可能
drop policy if exists "Shift group participants can create chat notifications" on notifications;
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- shift_group_idが設定されている場合のみ
  shift_group_id is not null
  and
  -- そのシフトグループの参加者である
  exists (
    select 1 from shift_assignments
    where shift_group_id = notifications.shift_group_id
    and user_id = auth.uid()
  )
);

