-- ==========================================
-- 通知作成ポリシーの修正（デバッグ情報付き）
-- ==========================================
-- 
-- 問題: 関数は正常に動作しているが、まだ403エラーが発生する
-- 原因の可能性: ポリシー評価時にauth.uid()が正しく取得できていない
-- 
-- 解決策: より確実な方法でポリシーを実装し、デバッグ情報を追加

-- ==========================================
-- 1. 既存のポリシーを削除
-- ==========================================

drop policy if exists "Shift group participants can create chat notifications" on notifications;

-- ==========================================
-- 2. 関数を再確認・再作成（念のため）
-- ==========================================

-- 関数が存在するか確認
select 
  proname,
  prosecdef,
  case 
    when prosecdef then 'security definer - OK'
    else 'security invoker - 問題の可能性'
  end as security_status
from pg_proc 
where proname = 'is_shift_group_participant';

-- 関数を再作成（確実に動作するように）
drop function if exists is_shift_group_participant(uuid, uuid);

create or replace function is_shift_group_participant(
  p_shift_group_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_result boolean;
begin
  -- shift_assignmentsテーブルから直接チェック
  -- security definerにより、RLSポリシーをバイパスしてアクセス可能
  select exists (
    select 1 
    from public.shift_assignments
    where shift_group_id = p_shift_group_id
    and user_id = p_user_id
  ) into v_result;
  
  -- nullの場合はfalseを返す
  return coalesce(v_result, false);
end;
$$;

-- ==========================================
-- 3. ポリシーを再作成（より確実な方法）
-- ==========================================

-- 重要: with check句内で、auth.uid()が正しく取得できることを確認
-- また、shift_group_idがnullでないことも確認
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  -- 基本的なチェック
  shift_group_id is not null
  and
  auth.uid() is not null  -- 認証されていることを確認
  and
  -- そのシフトグループの参加者である（security definer関数を使用）
  is_shift_group_participant(shift_group_id, auth.uid())
);

-- ==========================================
-- 4. ポリシーの確認
-- ==========================================

-- ポリシーが正しく作成されているか確認
select 
  policyname,
  cmd,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
and cmd = 'INSERT'
order by policyname;

-- ==========================================
-- 5. テスト用のクエリ（実際のアプリケーションで実行されるクエリをシミュレート）
-- ==========================================

-- 注意: このテストは、実際のアプリケーションで実行されるクエリをシミュレートします
-- ただし、Supabase DashboardのSQL Editorではauth.uid()がnullになるため、
-- 実際のアプリケーションでテストする必要があります

-- テスト用のINSERT（コメントアウト - 実際のアプリケーションでテスト）
/*
-- 実際のアプリケーションで実行されるクエリ:
insert into notifications (
  target_user_id, 
  title, 
  body, 
  scheduled_at, 
  shift_group_id, 
  created_by
)
values (
  '3a5b2d8d-9081-422a-80ea-9c6120f6701d'::uuid,
  '12/7 14:00〜18:00、受付',
  'test2：t',
  '2025-12-07T06:26:05.955Z'::timestamptz,
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
  '787b27ed-5ef8-48ef-a93c-694c351137a2'::uuid
);
*/

-- ==========================================
-- 6. 追加の確認事項
-- ==========================================

-- アプリケーション側で確認すべきこと:
-- 1. ユーザーが正しくログインしているか（supabase.auth.getUser()で確認）
-- 2. shift_group_idが正しく設定されているか（console.logで確認）
-- 3. created_byが正しく設定されているか（console.logで確認）
-- 4. すべての必須フィールドが設定されているか

-- ブラウザのコンソールで確認すべきログ:
-- - "通知作成開始:" のログで、payloadsCount, shiftGroupId, currentUserIdが正しく表示されているか
-- - firstPayloadの内容が正しいか（特にshift_group_idとcreated_by）

