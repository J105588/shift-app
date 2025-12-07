-- ==========================================
-- マイグレーション: 管理者チャット管理機能
-- ==========================================
-- 
-- 管理者がチャットメッセージを閲覧・作成・削除できるようにするポリシーを追加

-- 管理者は全てのチャットメッセージを閲覧可能
drop policy if exists "Admins can view all chat messages" on shift_group_chat_messages;
create policy "Admins can view all chat messages"
on shift_group_chat_messages for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

-- 管理者は全てのチャットグループにメッセージを送信可能
drop policy if exists "Admins can create chat messages" on shift_group_chat_messages;
create policy "Admins can create chat messages"
on shift_group_chat_messages for insert
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
  and user_id = auth.uid()
);

-- 管理者は全てのチャットメッセージを削除可能
drop policy if exists "Admins can delete all chat messages" on shift_group_chat_messages;
create policy "Admins can delete all chat messages"
on shift_group_chat_messages for delete
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

