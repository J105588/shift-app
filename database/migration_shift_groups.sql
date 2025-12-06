-- ==========================================
-- マイグレーション: シフト付与機能の再設計
-- 団体付与と個別付与の両方に対応するためのデータ構造変更
-- ==========================================

-- 1. shift_groupsテーブルを作成（業務枠の情報）
create table if not exists shift_groups (
  id uuid primary key default uuid_generate_v4(),
  title text not null, -- 業務内容
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  description text, -- 詳細メモ
  location text, -- 場所（将来の拡張用）
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. shift_assignmentsテーブルを作成（参加者の情報）
create table if not exists shift_assignments (
  id uuid primary key default uuid_generate_v4(),
  shift_group_id uuid references shift_groups(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  is_supervisor boolean default false, -- 統括者フラグ
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(shift_group_id, user_id) -- 同じシフトグループに同じユーザーを重複登録できない
);

-- 3. インデックスを追加
create index if not exists idx_shift_groups_start_time on shift_groups(start_time);
create index if not exists idx_shift_groups_end_time on shift_groups(end_time);
create index if not exists idx_shift_assignments_group_id on shift_assignments(shift_group_id);
create index if not exists idx_shift_assignments_user_id on shift_assignments(user_id);
create index if not exists idx_shift_assignments_supervisor on shift_assignments(shift_group_id, is_supervisor) where is_supervisor = true;

-- 4. 既存のshiftsテーブルのデータを新しい構造に移行
-- 既存のシフトをshift_groupsとshift_assignmentsに変換
insert into shift_groups (id, title, start_time, end_time, description, created_at)
select 
  id,
  title,
  start_time,
  end_time,
  description,
  created_at
from shifts
where id not in (select id from shift_groups);

-- 既存のシフトの参加者をshift_assignmentsに登録
insert into shift_assignments (shift_group_id, user_id, is_supervisor, created_at)
select 
  s.id as shift_group_id,
  s.user_id,
  case when s.supervisor_id = s.user_id then true else false end as is_supervisor,
  s.created_at
from shifts s
where not exists (
  select 1 from shift_assignments sa 
  where sa.shift_group_id = s.id and sa.user_id = s.user_id
);

-- 既存のシフトにsupervisor_idが設定されていて、user_idと異なる場合
-- そのsupervisorも参加者として追加（統括者として）
insert into shift_assignments (shift_group_id, user_id, is_supervisor, created_at)
select 
  s.id as shift_group_id,
  s.supervisor_id as user_id,
  true as is_supervisor,
  s.created_at
from shifts s
where s.supervisor_id is not null 
  and s.supervisor_id != s.user_id
  and not exists (
    select 1 from shift_assignments sa 
    where sa.shift_group_id = s.id and sa.user_id = s.supervisor_id
  );

-- 5. RLS（セキュリティ）を有効化
alter table shift_groups enable row level security;
alter table shift_assignments enable row level security;

-- 6. shift_groupsのRLSポリシー
-- 閲覧: 誰でも閲覧可能
drop policy if exists "Shift groups are viewable by everyone" on shift_groups;
create policy "Shift groups are viewable by everyone" 
on shift_groups for select 
using (true);

-- 編集: 管理者のみ
drop policy if exists "Admins can manage shift groups" on shift_groups;
create policy "Admins can manage shift groups" 
on shift_groups for all 
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role = 'admin'
  )
);

-- 統括者は自分のシフトグループのdescriptionのみ更新可能
drop policy if exists "Supervisors can update own shift group description" on shift_groups;
create policy "Supervisors can update own shift group description" 
on shift_groups for update 
using (
  exists (
    select 1 from shift_assignments 
    where shift_group_id = shift_groups.id 
    and user_id = auth.uid() 
    and is_supervisor = true
  )
)
with check (
  exists (
    select 1 from shift_assignments 
    where shift_group_id = shift_groups.id 
    and user_id = auth.uid() 
    and is_supervisor = true
  )
);

-- 7. shift_assignmentsのRLSポリシー
-- 閲覧: 誰でも閲覧可能
drop policy if exists "Shift assignments are viewable by everyone" on shift_assignments;
create policy "Shift assignments are viewable by everyone" 
on shift_assignments for select 
using (true);

-- 編集: 管理者のみ
drop policy if exists "Admins can manage shift assignments" on shift_assignments;
create policy "Admins can manage shift assignments" 
on shift_assignments for all 
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role = 'admin'
  )
);

-- 8. updated_atを自動更新するトリガー関数
create or replace function update_shift_groups_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- 9. トリガーを作成
drop trigger if exists trigger_update_shift_groups_updated_at on shift_groups;
create trigger trigger_update_shift_groups_updated_at
  before update on shift_groups
  for each row
  execute function update_shift_groups_updated_at();

