-- シフトグループチャットの既読管理テーブル
create table if not exists shift_group_chat_read_receipts (
  message_id uuid references shift_group_chat_messages(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (message_id, user_id)
);

create index if not exists idx_shift_group_chat_read_receipts_user on shift_group_chat_read_receipts(user_id);
create index if not exists idx_shift_group_chat_read_receipts_message on shift_group_chat_read_receipts(message_id);

-- RLS
alter table shift_group_chat_read_receipts enable row level security;

-- そのシフトグループの参加者のみ参照可能
drop policy if exists "Shift group participants can view read receipts" on shift_group_chat_read_receipts;
create policy "Shift group participants can view read receipts"
on shift_group_chat_read_receipts for select
using (
  exists (
    select 1 from shift_group_chat_messages m
    join shift_assignments sa on sa.shift_group_id = m.shift_group_id
    where m.id = shift_group_chat_read_receipts.message_id
    and sa.user_id = auth.uid()
  )
);

-- 自分の既読だけ登録・更新可能
drop policy if exists "Users can upsert own read receipts" on shift_group_chat_read_receipts;
create policy "Users can upsert own read receipts"
on shift_group_chat_read_receipts for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from shift_group_chat_messages m
    join shift_assignments sa on sa.shift_group_id = m.shift_group_id
    where m.id = shift_group_chat_read_receipts.message_id
    and sa.user_id = auth.uid()
  )
);

-- 既読は更新不要だがupsert対応のためupdateも許可（自分の行のみ）
drop policy if exists "Users can update own read receipts" on shift_group_chat_read_receipts;
create policy "Users can update own read receipts"
on shift_group_chat_read_receipts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());


