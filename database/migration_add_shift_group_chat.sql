-- ==========================================
-- マイグレーション: 団体シフトグループチャット機能
-- ==========================================

-- チャットメッセージテーブル
create table if not exists shift_group_chat_messages (
  id uuid primary key default uuid_generate_v4(),
  shift_group_id uuid references shift_groups(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- インデックスを追加
create index if not exists idx_shift_group_chat_messages_group_id on shift_group_chat_messages(shift_group_id);
create index if not exists idx_shift_group_chat_messages_created_at on shift_group_chat_messages(created_at);
create index if not exists idx_shift_group_chat_messages_user_id on shift_group_chat_messages(user_id);

-- RLS（セキュリティ）を有効化
alter table shift_group_chat_messages enable row level security;

-- 閲覧: そのシフトグループの参加者のみ閲覧可能
drop policy if exists "Shift group chat messages are viewable by participants" on shift_group_chat_messages;
create policy "Shift group chat messages are viewable by participants" 
on shift_group_chat_messages for select 
using (
  exists (
    select 1 from shift_assignments 
    where shift_group_id = shift_group_chat_messages.shift_group_id 
    and user_id = auth.uid()
  )
);

-- 作成: そのシフトグループの参加者のみ作成可能
drop policy if exists "Shift group participants can create chat messages" on shift_group_chat_messages;
create policy "Shift group participants can create chat messages" 
on shift_group_chat_messages for insert 
with check (
  exists (
    select 1 from shift_assignments 
    where shift_group_id = shift_group_chat_messages.shift_group_id 
    and user_id = auth.uid()
  )
  and user_id = auth.uid()
);

-- 削除: 自分のメッセージのみ削除可能
drop policy if exists "Users can delete own chat messages" on shift_group_chat_messages;
create policy "Users can delete own chat messages" 
on shift_group_chat_messages for delete 
using (user_id = auth.uid());

