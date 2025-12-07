-- ==========================================
-- マイグレーション: チャット通知作成ポリシー
-- ==========================================
-- 
-- チャット通知（shift_group_idが設定されている通知）は、
-- そのシフトグループの参加者が作成できるようにする
-- 既存の"Admins manage notifications"ポリシーは`for all`なので、
-- 個別の操作に分割して、チャット通知用のINSERTポリシーを追加する
-- 既存の"Admins manage notifications"ポリシーを削除
drop policy if exists "Admins manage notifications" on notifications;

-- 管理者は全ての通知をSELECT可能
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

-- 管理者は全ての通知をINSERT可能
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

-- 管理者は全ての通知をUPDATE可能
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

-- 管理者は全ての通知をDELETE可能
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
  -- INSERT時は、挿入される行のshift_group_idを参照する
  -- テーブル名を明示的に指定
  exists (
    select 1 from shift_assignments sa
    where sa.shift_group_id = notifications.shift_group_id
    and sa.user_id = auth.uid()
  )
);

