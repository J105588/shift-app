# 通知作成エラー（403 Forbidden）のトラブルシューティング

## 問題

チャット通知作成時に以下のエラーが発生:
```
new row violates row-level security policy for table "notifications"
```

## 解決手順

### ステップ1: 現在の状態を確認

Supabase DashboardのSQL Editorで以下を実行:

```sql
-- 1. 現在のユーザーIDを確認
select auth.uid() as current_user_id;

-- 2. 現在のユーザーのロールを確認
select id, display_name, role 
from profiles 
where id = auth.uid();

-- 3. シフトグループの参加者を確認
-- （シフトグループIDを実際のIDに置き換えてください）
select * 
from shift_assignments 
where shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid;

-- 4. 現在のユーザーがそのシフトグループの参加者かどうかを確認
select * 
from shift_assignments 
where shift_group_id = '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid
and user_id = auth.uid();
```

### ステップ2: 関数が正しく動作しているか確認

```sql
-- 関数が存在するか確認
select proname, prosecdef, prosrc
from pg_proc 
where proname = 'is_shift_group_participant';

-- 関数を直接テスト
select is_shift_group_participant(
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
  auth.uid()
) as is_participant;

-- テスト関数を使用（v3マイグレーションを実行した場合）
select * from test_is_participant('8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid);
```

### ステップ3: 現在のポリシーを確認

```sql
-- notificationsテーブルのRLSポリシーを確認
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'notifications'
order by policyname;
```

### ステップ4: マイグレーションを適用

以下のいずれかのマイグレーションを実行:

1. **推奨**: `migration_fix_notification_policies_v3.sql`（最新版、security definer使用）
2. 代替: `migration_fix_notification_policies_v2.sql`（security definer使用）
3. 代替: `migration_fix_all_notification_policies.sql`（security invoker使用）

### ステップ5: マイグレーション適用後の確認

```sql
-- ポリシーが正しく作成されているか確認
select policyname, cmd, with_check
from pg_policies
where tablename = 'notifications'
and cmd = 'INSERT';

-- 関数が正しく動作しているか再確認
select is_shift_group_participant(
  '8b9b0f8a-7df0-48b5-acbb-9a79389b0086'::uuid,
  auth.uid()
) as is_participant;
```

## よくある問題と解決策

### 問題1: ユーザーがshift_assignmentsに存在しない

**症状**: `is_shift_group_participant()`が`false`を返す

**解決策**: 
- シフトグループに正しく参加者として登録されているか確認
- 必要に応じて、管理者がshift_assignmentsテーブルに直接追加

### 問題2: auth.uid()がnullを返す

**症状**: 認証されていない状態で実行されている

**解決策**: 
- アプリケーション側で、ユーザーが正しくログインしているか確認
- Supabaseクライアントが正しく初期化されているか確認

### 問題3: 関数が正しく作成されていない

**症状**: `is_shift_group_participant()`が存在しない、またはエラーが発生する

**解決策**: 
- マイグレーションを再実行
- 関数の定義を確認:
  ```sql
  \df+ is_shift_group_participant
  ```

### 問題4: ポリシーが正しく適用されていない

**症状**: ポリシーが存在しない、または古いポリシーが残っている

**解決策**: 
- すべてのポリシーを削除してから再作成:
  ```sql
  -- すべてのポリシーを削除
  drop policy if exists "Admins manage notifications" on notifications;
  drop policy if exists "Admins can view all notifications" on notifications;
  drop policy if exists "Admins can insert notifications" on notifications;
  drop policy if exists "Admins can update notifications" on notifications;
  drop policy if exists "Admins can delete notifications" on notifications;
  drop policy if exists "Users can view own notifications" on notifications;
  drop policy if exists "Shift group participants can create chat notifications" on notifications;
  ```
- その後、マイグレーションを再実行

## 代替アプローチ（関数が動作しない場合）

関数ベースのアプローチが動作しない場合、ポリシー内で直接サブクエリを使用する方法を試すことができます:

```sql
-- 注意: この方法はPostgreSQLのバージョンによっては動作しない場合があります
create policy "Shift group participants can create chat notifications"
on notifications
for insert
with check (
  shift_group_id is not null
  and
  exists (
    select 1 
    from shift_assignments sa
    where sa.shift_group_id = notifications.shift_group_id
    and sa.user_id = auth.uid()
  )
);
```

ただし、この方法では`notifications.shift_group_id`という参照が正しく解決されない可能性があります。

## 最終手段

すべての方法が失敗する場合、一時的にRLSを無効化してテストすることもできます（本番環境では推奨されません）:

```sql
-- 注意: これはセキュリティリスクがあるため、テスト環境でのみ使用
alter table notifications disable row level security;
```

テスト後、必ずRLSを再有効化してください:

```sql
alter table notifications enable row level security;
```

