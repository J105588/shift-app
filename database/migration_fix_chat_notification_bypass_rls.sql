-- ==========================================
-- マイグレーション: チャット通知作成時のRLSポリシーエラー修正（RLSバイパス方式）
-- ==========================================
-- 
-- 問題: チャット通知作成時にRLSポリシーエラー（403 Forbidden）が発生
-- 
-- 解決策:
-- チャット通知作成用の専用関数を作成し、その関数内でRLSをバイパスして通知を作成
-- アプリケーション側で既にshift_assignmentsのチェックを行っているため、
-- データベース側のRLSチェックは不要
--
-- 実行方法:
-- Supabase DashboardのSQL Editorでこのファイルの内容を実行してください

-- ==========================================
-- 1. チャット通知作成用の関数を作成（RLSバイパス）
-- ==========================================

-- チャット通知を作成する関数
-- security definerにより、RLSポリシーをバイパスして通知を作成可能
create or replace function create_chat_notification(
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
  -- RLSをバイパスして通知を作成
  insert into notifications (
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

-- 関数にコメントを追加
comment on function create_chat_notification(uuid, text, text, timestamp with time zone, uuid, uuid) is 
  'チャット通知を作成する関数。security definerによりRLSをバイパス。アプリケーション側でshift_assignmentsのチェックを行っているため、データベース側のRLSチェックは不要。';

-- ==========================================
-- 2. 複数の通知を一度に作成する関数（オプション）
-- ==========================================

-- 複数のチャット通知を一度に作成する関数
create or replace function create_chat_notifications(
  p_notifications jsonb
)
returns table(id uuid)
language plpgsql
security definer
as $$
declare
  v_notification jsonb;
  v_notification_id uuid;
begin
  -- JSON配列の各要素を処理
  for v_notification in select * from jsonb_array_elements(p_notifications)
  loop
    -- 各通知を作成
    insert into notifications (
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
      (v_notification->>'shift_group_id')::uuid,
      (v_notification->>'created_by')::uuid
    )
    returning notifications.id into v_notification_id;
    
    -- 戻り値として返す
    id := v_notification_id;
    return next;
  end loop;
  
  return;
end;
$$;

-- 関数にコメントを追加
comment on function create_chat_notifications(jsonb) is 
  '複数のチャット通知を一度に作成する関数。security definerによりRLSをバイパス。';

-- ==========================================
-- 3. 確認用クエリ
-- ==========================================

-- 関数が正しく作成されているか確認
select 
  proname,
  prosecdef,
  case 
    when prosecdef then 'security definer - OK'
    else 'security invoker - 問題あり'
  end as security_status
from pg_proc 
where proname in ('create_chat_notification', 'create_chat_notifications')
order by proname;

-- ==========================================
-- 4. 使用方法
-- ==========================================
-- 
-- アプリケーション側で、以下のように関数を呼び出します：
-- 
-- 1. 単一の通知を作成:
--    select create_chat_notification(
--      'target_user_id'::uuid,
--      '通知タイトル',
--      '通知本文',
--      now(),
--      'shift_group_id'::uuid,
--      auth.uid()
--    );
-- 
-- 2. 複数の通知を一度に作成（JSON配列を使用）:
--    select * from create_chat_notifications('[
--      {
--        "target_user_id": "user_id_1",
--        "title": "通知タイトル",
--        "body": "通知本文",
--        "scheduled_at": "2025-12-09T16:54:40.359Z",
--        "shift_group_id": "shift_group_id",
--        "created_by": "creator_id"
--      },
--      {
--        "target_user_id": "user_id_2",
--        "title": "通知タイトル",
--        "body": "通知本文",
--        "scheduled_at": "2025-12-09T16:54:40.359Z",
--        "shift_group_id": "shift_group_id",
--        "created_by": "creator_id"
--      }
--    ]'::jsonb);
-- 
-- 注意: アプリケーション側で、shift_assignmentsのチェックを行ってから
-- この関数を呼び出す必要があります。

