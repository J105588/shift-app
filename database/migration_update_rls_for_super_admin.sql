-- ==========================================
-- Migration: Update RLS policies to include 'super_admin'
-- This file updates ALL tables that have Admin-specific policies.
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
drop policy if exists "Admins manage notifications" on notifications; -- Safety drop for old monolith policy
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

-- 6. App Settings Table (Fixing "new row violates row-level security policy" error)
drop policy if exists "Only admins can manage settings" on app_settings;
create policy "Only admins can manage settings"
on app_settings for all
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

-- 7. App Updates Table
drop policy if exists "Only admins can insert app updates" on app_updates;
create policy "Only admins can insert app updates"
on app_updates for insert
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);

-- 8. Shift Group Chat Messages Table
-- Admins/Super Admins should be able to VIEW all messages for moderation
drop policy if exists "Admins can view all chat messages" on shift_group_chat_messages;
create policy "Admins can view all chat messages"
on shift_group_chat_messages for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);

-- Admins/Super Admins should be able to DELETE any message for moderation
drop policy if exists "Admins can delete any chat message" on shift_group_chat_messages;
create policy "Admins can delete any chat message"
on shift_group_chat_messages for delete
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);

-- Admins/Super Admins should be able to INSERT messages (e.g. announcements in channel)
-- Note: Logic requires them to be participants usually, but we can allow force insert
-- Only if they are actually added to the group in UI?
-- For now, let's allow them to insert if they are role=admin/super_admin, bypassing participant check
drop policy if exists "Admins can insert chat messages" on shift_group_chat_messages;
create policy "Admins can insert chat messages"
on shift_group_chat_messages for insert
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);

-- 9. Shift Group Chat Read Receipts
-- Admins/Super Admins should be able to VIEW all receipts
drop policy if exists "Admins can view all read receipts" on shift_group_chat_read_receipts;
create policy "Admins can view all read receipts"
on shift_group_chat_read_receipts for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);

-- 10. Push Subscriptions
-- Admins/Super Admins should be able to VIEW all subscriptions (for debugging)
drop policy if exists "Admins can view all push subscriptions" on push_subscriptions;
create policy "Admins can view all push subscriptions"
on push_subscriptions for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
);
