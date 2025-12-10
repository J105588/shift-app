-- ==========================================
-- マイグレーション: シフトに色を設定できるようにする
-- ==========================================

-- 1. shiftsテーブルにcolorカラムを追加
alter table shifts add column if not exists color text;

-- 2. shift_groupsテーブルにcolorカラムを追加
alter table shift_groups add column if not exists color text;

-- 3. app_settingsにシフトテンプレート設定を追加（初期値）
insert into app_settings (key, value, description)
values (
  'shift_templates',
  '[
    {"name": "受付", "color": "#3b82f6"},
    {"name": "案内", "color": "#10b981"},
    {"name": "販売", "color": "#f59e0b"},
    {"name": "会計", "color": "#ef4444"},
    {"name": "準備", "color": "#8b5cf6"},
    {"name": "片付け", "color": "#6366f1"},
    {"name": "休憩", "color": "#94a3b8"},
    {"name": "統括", "color": "#ec4899"},
    {"name": "サポート", "color": "#06b6d4"},
    {"name": "その他", "color": "#64748b"}
  ]',
  'シフトテンプレートと色の設定（JSON形式）'
)
on conflict (key) do nothing;

-- 4. app_settingsに自由入力シフトのデフォルト色を追加
insert into app_settings (key, value, description)
values (
  'shift_custom_color',
  '#64748b',
  '自由入力シフトのデフォルト色'
)
on conflict (key) do nothing;

