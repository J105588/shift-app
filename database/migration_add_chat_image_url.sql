-- チャットメッセージに画像URLを保存するカラムを追加
alter table if exists shift_group_chat_messages
add column if not exists image_url text;

-- 既存データ向けにデフォルトはNULL（テキストメッセージのみ）


