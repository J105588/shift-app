-- ==========================================
-- マイグレーション: shiftsテーブルにsupervisor_id（統括者）フィールドを追加
-- ==========================================

-- supervisor_idカラムを追加（統括者のID、NULL可）
alter table shifts 
add column supervisor_id uuid references profiles(id) on delete set null;

-- インデックスを追加（パフォーマンス向上のため）
create index if not exists idx_shifts_supervisor_id on shifts(supervisor_id);

