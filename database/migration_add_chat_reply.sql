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
add column if not exists reply_to uuid references shift_group_chat_messages(id) on delete set null;

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

