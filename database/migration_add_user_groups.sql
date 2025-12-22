-- ==========================================
-- マイグレーション: profilesテーブルにグループ名(group_name)を追加
-- ユーザー管理画面でのグループ分け機能に使用
-- ==========================================

-- group_nameカラムを追加（テキスト、NULL可）
alter table profiles 
add column if not exists group_name text;

-- インデックスを追加（フィルタリングや検索のパフォーマンス向上）
create index if not exists idx_profiles_group_name on profiles(group_name);
