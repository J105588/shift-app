-- ==========================================
-- マイグレーション: 管理者の既読情報閲覧ポリシー追加
-- ==========================================
-- 
-- 管理者が全てのチャットメッセージの既読情報を閲覧できるようにする

-- 管理者は全ての既読情報を閲覧可能
drop policy if exists "Admins can view all read receipts" on shift_group_chat_read_receipts;
create policy "Admins can view all read receipts"
on shift_group_chat_read_receipts for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

-- 管理者は全てのメッセージの既読を登録可能（必要に応じて）
drop policy if exists "Admins can upsert read receipts" on shift_group_chat_read_receipts;
create policy "Admins can upsert read receipts"
on shift_group_chat_read_receipts for insert
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
  and user_id = auth.uid()
);

