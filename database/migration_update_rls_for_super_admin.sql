-- ==========================================
-- Migration: Update RLS policies to include 'super_admin'
-- ==========================================

-- 1. Profiles Table
drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles" 
on profiles for update 
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'super_admin')
  )
);

-- 2. Shifts Table
drop policy if exists "Admins can manage all shifts" on shifts;
create policy "Admins can manage all shifts" 
on shifts for all 
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'super_admin')
  )
);

-- 3. Shift Groups Table
drop policy if exists "Admins can manage shift groups" on shift_groups;
create policy "Admins can manage shift groups" 
on shift_groups for all 
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'super_admin')
  )
);

-- 4. Shift Assignments Table
drop policy if exists "Admins can manage shift assignments" on shift_assignments;
create policy "Admins can manage shift assignments" 
on shift_assignments for all 
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'super_admin')
  )
);

-- 5. Notifications Table
drop policy if exists "Admins can view all notifications" on notifications;
create policy "Admins can view all notifications"
on notifications for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);

drop policy if exists "Admins can insert notifications" on notifications;
create policy "Admins can insert notifications"
on notifications for insert
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);

drop policy if exists "Admins can update notifications" on notifications;
create policy "Admins can update notifications"
on notifications for update
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);

drop policy if exists "Admins can delete notifications" on notifications;
create policy "Admins can delete notifications"
on notifications for delete
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);
