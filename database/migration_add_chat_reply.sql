-- ==========================================
-- マイグレーション: チャットメッセージのリプライ機能
-- ==========================================
-- 
-- shift_group_chat_messages テーブルに reply_to カラムを追加
-- これにより、メッセージに対してリプライできるようになります
--
-- 実行方法:
-- Supabase DashboardのSQL Editorでこのファイルの内容を実行してください

-- ==========================================
-- 1. reply_to カラムを追加
-- ==========================================

-- reply_to カラムを追加（リプライ先のメッセージID）
alter table shift_group_chat_messages
add column if not exists reply_to uuid;

-- 外部キー制約を明示的に作成（Supabaseがリレーションシップを認識できるように）
alter table shift_group_chat_messages
drop constraint if exists shift_group_chat_messages_reply_to_fkey;

alter table shift_group_chat_messages
add constraint shift_group_chat_messages_reply_to_fkey
foreign key (reply_to)
references shift_group_chat_messages(id)
on delete set null;

-- インデックスを追加（リプライ先メッセージの検索を高速化）
create index if not exists idx_shift_group_chat_messages_reply_to 
on shift_group_chat_messages(reply_to);

-- ==========================================
-- 2. 確認用クエリ
-- ==========================================

-- カラムが正しく追加されたか確認
select 
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_name = 'shift_group_chat_messages'
  and column_name = 'reply_to';

-- 外部キー制約が正しく作成されたか確認
select 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints as tc
join information_schema.key_column_usage as kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage as ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_name = 'shift_group_chat_messages'
  and kcu.column_name = 'reply_to';

-- ==========================================
-- 3. Supabaseのスキーマキャッシュを更新
-- ==========================================
-- 
-- 注意: Supabaseは外部キー制約を追加した後、
-- PostgRESTのスキーマキャッシュを更新する必要があります。
-- 通常は自動的に更新されますが、手動で更新する場合は以下を実行：
-- 
-- NOTIFY pgrst, 'reload schema';
-- 
-- または、Supabase Dashboardの「Settings」→「API」→「Reload schema」をクリック

