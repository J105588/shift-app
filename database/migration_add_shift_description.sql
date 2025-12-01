-- ==========================================
-- マイグレーション: shiftsテーブルにdescription（仕事内容メモ）を追加
-- ==========================================

alter table shifts
add column if not exists description text;

comment on column shifts.description is '仕事内容メモ（任意）';

