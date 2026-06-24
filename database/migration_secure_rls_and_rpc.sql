-- ==========================================
-- マイグレーション: RLS および RPC 関数のセキュリティ強化
-- ==========================================

-- --------------------------------------------------
-- 1. チャット通知作成用 RPC 関数のセキュリティチェック追加
-- --------------------------------------------------

-- 1-1. 単一の通知作成関数
create or replace function public.create_chat_notification(
  p_target_user_id uuid,
  p_title text,
  p_body text,
  p_scheduled_at timestamp with time zone,
  p_shift_group_id uuid,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_notification_id uuid;
begin
  -- セキュリティチェック:
  -- 1. 呼び出し元(auth.uid())が管理者/スーパー管理者であること
  -- または、
  -- 2. 呼び出し元が作成者(p_created_by)本人であり、かつそのシフトグループの参加者であること
  if not (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
    or
    (
      auth.uid() = p_created_by
      and exists (
        select 1 from public.shift_assignments
        where shift_group_id = p_shift_group_id
        and user_id = auth.uid()
      )
    )
  ) then
    raise exception 'Permission denied: Invalid sender or user is not a participant of the shift group.';
  end if;

  -- RLSをバイパスして通知を作成
  insert into public.notifications (
    target_user_id,
    title,
    body,
    scheduled_at,
    shift_group_id,
    created_by
  )
  values (
    p_target_user_id,
    p_title,
    p_body,
    p_scheduled_at,
    p_shift_group_id,
    p_created_by
  )
  returning id into v_notification_id;
  
  return v_notification_id;
end;
$$;

comment on function public.create_chat_notification(uuid, text, text, timestamp with time zone, uuid, uuid) is 
  'チャット通知を作成する関数。呼び出し元の権限と所属グループをデータベース側で検証した上でRLSをバイパスします。';


-- 1-2. 複数の一括通知作成関数
create or replace function public.create_chat_notifications(
  p_notifications jsonb
)
returns table(id uuid)
language plpgsql
security definer
as $$
declare
  v_notification jsonb;
  v_notification_id uuid;
  v_created_by uuid;
  v_shift_group_id uuid;
  v_is_admin boolean;
begin
  -- 呼び出し元が管理者/スーパー管理者かどうかをチェック
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) into v_is_admin;

  -- JSON配列の各要素を処理
  for v_notification in select * from jsonb_array_elements(p_notifications)
  loop
    v_created_by := (v_notification->>'created_by')::uuid;
    v_shift_group_id := (v_notification->>'shift_group_id')::uuid;

    -- セキュリティチェック:
    -- 1. 管理者である
    -- または、
    -- 2. 呼び出し元が作成者本人であり、かつそのシフトグループの参加者であること
    if not (
      v_is_admin
      or
      (
        auth.uid() = v_created_by
        and exists (
          select 1 from public.shift_assignments
          where shift_group_id = v_shift_group_id
          and user_id = auth.uid()
        )
      )
    ) then
      raise exception 'Permission denied: Invalid sender or user is not a participant of the shift group.';
    end if;

    -- 各通知を作成
    insert into public.notifications (
      target_user_id,
      title,
      body,
      scheduled_at,
      shift_group_id,
      created_by
    )
    values (
      (v_notification->>'target_user_id')::uuid,
      v_notification->>'title',
      v_notification->>'body',
      (v_notification->>'scheduled_at')::timestamp with time zone,
      v_shift_group_id,
      v_created_by
    )
    returning notifications.id into v_notification_id;
    
    id := v_notification_id;
    return next;
  end loop;
  
  return;
end;
$$;

comment on function public.create_chat_notifications(jsonb) is 
  '複数のチャット通知を一括作成する関数。呼び出し元の権限と所属グループをデータベース側で検証した上でRLSをバイパスします。';


-- --------------------------------------------------
-- 2. 統括者(Supervisor)による更新可能カラムの制限トリガー
-- --------------------------------------------------

-- 2-1. シフトテーブル用 (shifts)
create or replace function public.check_supervisor_shift_update()
returns trigger
language plpgsql
security definer
as $$
declare
  v_is_admin boolean;
begin
  -- 呼び出し元が管理者/スーパー管理者であれば全ての変更を無条件に許可
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) into v_is_admin;

  if v_is_admin then
    return NEW;
  end if;

  -- 統括者の場合: description 以外のカラムが変更されていないかを厳格に検証
  if (OLD.id is distinct from NEW.id) or
     (OLD.user_id is distinct from NEW.user_id) or
     (OLD.title is distinct from NEW.title) or
     (OLD.start_time is distinct from NEW.start_time) or
     (OLD.end_time is distinct from NEW.end_time) or
     (OLD.supervisor_id is distinct from NEW.supervisor_id) or
     (OLD.created_at is distinct from NEW.created_at) then
    raise exception 'Permission denied: Supervisors can only update the description field.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_supervisor_shift_update on public.shifts;
create trigger trg_check_supervisor_shift_update
  before update on public.shifts
  for each row
  execute function public.check_supervisor_shift_update();


-- 2-2. シフトグループテーブル用 (shift_groups)
create or replace function public.check_supervisor_shift_group_update()
returns trigger
language plpgsql
security definer
as $$
declare
  v_is_admin boolean;
begin
  -- 呼び出し元が管理者/スーパー管理者であれば全ての変更を無条件に許可
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) into v_is_admin;

  if v_is_admin then
    return NEW;
  end if;

  -- 統括者の場合: description 以外のカラムが変更されていないかを厳格に検証
  if (OLD.id is distinct from NEW.id) or
     (OLD.title is distinct from NEW.title) or
     (OLD.start_time is distinct from NEW.start_time) or
     (OLD.end_time is distinct from NEW.end_time) or
     (OLD.location is distinct from NEW.location) or
     (OLD.created_at is distinct from NEW.created_at) then
    raise exception 'Permission denied: Supervisors can only update the description field.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_supervisor_shift_group_update on public.shift_groups;
create trigger trg_check_supervisor_shift_group_update
  before update on public.shift_groups
  for each row
  execute function public.check_supervisor_shift_group_update();
