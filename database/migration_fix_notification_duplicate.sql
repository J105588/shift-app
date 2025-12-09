-- ==========================================
-- マイグレーション: 通知の重複送信を防ぐ（アトミックな更新）
-- ==========================================
-- 
-- 問題: 通知が重複して届く（同じ内容の通知が2件届く）
-- 
-- 原因: markNotificationSent関数のチェックと更新の間に競合状態が発生
--       Webhookと通常のトリガーが同時に実行された場合、両方が同じ通知を処理する可能性がある
-- 
-- 解決策:
-- PostgreSQLのSELECT ... FOR UPDATE SKIP LOCKEDを使用して、
-- アトミックな更新を行う関数を作成
--
-- 実行方法:
-- Supabase DashboardのSQL Editorでこのファイルの内容を実行してください

-- ==========================================
-- 1. アトミックな通知送信マーク関数を作成
-- ==========================================

-- 通知を送信済みにマークする関数（アトミックな更新）
-- SELECT ... FOR UPDATE SKIP LOCKEDを使用して、重複処理を防ぐ
create or replace function mark_notification_sent_atomic(
  p_notification_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_updated_count integer;
  v_locked_id uuid;
begin
  -- SELECT ... FOR UPDATE SKIP LOCKEDを使用して、アトミックなロックを取得
  -- 既にロックされている通知はスキップされるため、重複処理を防げる
  select id into v_locked_id
  from notifications
  where id = p_notification_id
    and sent_at is null
  for update skip locked
  limit 1;
  
  -- ロックが取得できなかった場合（既に他のプロセスで処理中）は false を返す
  if v_locked_id is null then
    return false;
  end if;
  
  -- ロックが取得できた場合、更新を実行
  update notifications
  set sent_at = now()
  where id = v_locked_id;
  
  -- 更新が成功した場合は true を返す
  return true;
end;
$$;

-- 関数にコメントを追加
comment on function mark_notification_sent_atomic(uuid) is 
  '通知を送信済みにマークする関数。SELECT ... FOR UPDATE SKIP LOCKEDを使用してアトミックな更新を保証し、重複処理を防ぐ。';

-- ==========================================
-- 2. 確認用クエリ
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
where proname = 'mark_notification_sent_atomic'
order by proname;

-- ==========================================
-- 3. 使用方法
-- ==========================================
-- 
-- GASのCode.gsで、以下のように関数を呼び出します：
-- 
-- var url = SUPABASE_URL + '/rest/v1/rpc/mark_notification_sent_atomic';
-- var options = {
--   method: 'post',
--   headers: {
--     apikey: SUPABASE_KEY,
--     Authorization: 'Bearer ' + SUPABASE_KEY,
--     'Content-Type': 'application/json',
--   },
--   payload: JSON.stringify({ p_notification_id: notifId }),
--   muteHttpExceptions: true,
-- };
-- 
-- var res = UrlFetchApp.fetch(url, options);
-- var result = JSON.parse(res.getContentText());
-- var success = result === true; // 関数はbooleanを返す

