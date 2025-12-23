# チャット通知作成時のRLSポリシーエラー修正手順

## 問題

チャット機能で通知を作成する際に、以下のエラーが発生します：

```
new row violates row-level security policy for table "notifications"
```

または

```
403 Forbidden
```

## 原因

`is_shift_group_participant`関数が`security invoker`で定義されているか、正しく作成されていない可能性があります。また、notificationsテーブルのRLSポリシーが正しく設定されていない可能性もあります。

## 解決方法

### ステップ0: 診断（推奨）

まず、現在の状態を確認するために、以下の診断マイグレーションを実行してください：

```
database/migration_diagnose_chat_notification_issue.sql
```

この診断マイグレーションは以下を確認します：

1. 現在のユーザー情報
2. 関数の状態（security definerかsecurity invokerか）
3. ポリシーの状態
4. shift_assignmentsテーブルのRLSポリシー

### ステップ1: マイグレーションの実行

Supabase DashboardのSQL Editorで、以下のいずれかのファイルの内容を実行してください：

#### 方法1: 関数ベースのアプローチ（推奨）

```
database/migration_fix_chat_notification_rls_final.sql
```

このマイグレーションは以下を行います：

1. `is_shift_group_participant`関数を`security definer`で再作成
2. すべてのnotificationsテーブルのRLSポリシーを削除して再作成
3. 確実に動作するように、すべてのポリシーを正しい順序で再作成

#### 方法2: RLSバイパス方式（推奨・最も確実）

```
database/migration_fix_chat_notification_bypass_rls.sql
```

このマイグレーションは以下を行います：

1. `create_chat_notification`関数を作成（単一の通知作成用）
2. `create_chat_notifications`関数を作成（複数の通知を一度に作成用）
3. これらの関数は`security definer`で作成され、RLSをバイパスして通知を作成

**注意**: 
- アプリケーション側で既に`shift_assignments`のチェックを行っているため、データベース側のRLSチェックは不要
- アプリケーション側のコードも修正が必要（既に修正済み）

#### 方法3: 直接サブクエリ方式（方法1と方法2が動作しない場合）

```
database/migration_fix_chat_notification_rls_direct.sql
```

このマイグレーションは以下を行います：

1. チャット通知作成ポリシーを削除
2. ポリシー内で直接サブクエリを使用して再作成（関数を使用しない）

**注意**: この方法は、`shift_assignments`テーブルが全員が閲覧可能である必要があります。

### ステップ2: マイグレーション実行後の確認

マイグレーション実行後、以下のクエリを実行して、正しく適用されているか確認してください：

```sql
-- 1. 関数が正しく作成されているか確認（security definerである必要がある）
select 
  proname,
  prosecdef,
  case 
    when prosecdef then 'security definer - OK'
    else 'security invoker - 問題あり'
  end as security_status
from pg_proc 
where proname = 'is_shift_group_participant';

-- 2. ポリシーが正しく作成されているか確認
select 
  policyname,
  cmd,
  with_check as with_check_clause
from pg_policies
where tablename = 'notifications'
order by cmd, policyname;

-- 3. 現在のユーザーIDを確認
select auth.uid() as current_user_id;

-- 4. 現在のユーザーのロールを確認
select id, display_name, role from profiles where id = auth.uid();
```

### ステップ3: 動作確認

1. アプリケーションにログイン
2. チャット機能を使用してメッセージを送信
3. ブラウザのコンソールでエラーが発生していないか確認
4. 通知が正しく作成されているか確認

## トラブルシューティング

### 問題1: マイグレーション実行後もエラーが発生する

**確認事項:**

1. **診断マイグレーションを実行**:
   ```sql
   -- database/migration_diagnose_chat_notification_issue.sql を実行
   ```

2. ユーザーが`shift_assignments`テーブルに正しく登録されているか確認：
   ```sql
   -- シフトグループIDを実際のIDに置き換えてください
   select * from shift_assignments 
   where shift_group_id = 'シフトグループID'::uuid
   and user_id = auth.uid();
   ```

3. 関数が正しく動作しているか確認（関数ベースのアプローチを使用している場合）：
   ```sql
   -- シフトグループIDを実際のIDに置き換えてください
   select * from test_is_participant('シフトグループID'::uuid);
   
   -- または関数を直接テスト
   select is_shift_group_participant('シフトグループID'::uuid, auth.uid()) as is_participant;
   ```

4. 関数が`security definer`で作成されているか確認：
   ```sql
   select proname, prosecdef from pg_proc where proname = 'is_shift_group_participant';
   -- prosecdefがtrueである必要があります
   ```

5. ポリシーが正しく作成されているか確認：
   ```sql
   select policyname, cmd, with_check 
   from pg_policies 
   where tablename = 'notifications' 
   and cmd = 'INSERT';
   ```

6. ブラウザのコンソールでエラーの詳細を確認（GroupChat.tsxとAdminChatManagement.tsxに詳細なログが出力されます）

**解決策:**

- 関数ベースのアプローチ（`migration_fix_chat_notification_rls_final.sql`）を実行したが、まだエラーが発生する場合:
  - 直接サブクエリ方式（`migration_fix_chat_notification_rls_direct.sql`）を試してください
- 直接サブクエリ方式でもエラーが発生する場合:
  - `shift_assignments`テーブルが全員が閲覧可能であることを確認してください
  - 診断マイグレーションを実行して、shift_assignmentsテーブルのRLSポリシーを確認してください

### 問題2: 関数が存在しない、またはエラーが発生する

**解決方法:**

マイグレーションファイルを再実行してください。関数が既に存在する場合は、`drop function if exists`により削除されてから再作成されます。

### 問題3: ポリシーが正しく作成されていない

**解決方法:**

1. すべてのポリシーを削除：
   ```sql
   drop policy if exists "Admins manage notifications" on notifications;
   drop policy if exists "Admins can view all notifications" on notifications;
   drop policy if exists "Admins can insert notifications" on notifications;
   drop policy if exists "Admins can update notifications" on notifications;
   drop policy if exists "Admins can delete notifications" on notifications;
   drop policy if exists "Users can view own notifications" on notifications;
   drop policy if exists "Shift group participants can create chat notifications" on notifications;
   ```

2. マイグレーションファイルを再実行

### 問題4: auth.uid()がnullを返す

**原因:**

認証されていない状態で実行されています。

**解決方法:**

1. アプリケーション側で、ユーザーが正しくログインしているか確認
2. Supabaseクライアントが正しく初期化されているか確認
3. ブラウザのコンソールで認証状態を確認

## 詳細なトラブルシューティング

より詳細なトラブルシューティング手順は、`database/TROUBLESHOOTING_NOTIFICATIONS.md`を参照してください。

## 関連ファイル

- `database/migration_diagnose_chat_notification_issue.sql`: 診断用マイグレーション（まずこれを実行）
- `database/migration_fix_chat_notification_bypass_rls.sql`: RLSバイパス方式（推奨・最も確実）
- `database/migration_fix_chat_notification_rls_final.sql`: 関数ベースのアプローチ
- `database/migration_fix_chat_notification_rls_direct.sql`: 直接サブクエリ方式
- `database/TROUBLESHOOTING_NOTIFICATIONS.md`: 詳細なトラブルシューティング手順
- `components/GroupChat.tsx`: チャット機能のコンポーネント（RLSバイパス関数を使用）
- `components/AdminChatManagement.tsx`: 管理者チャット管理コンポーネント（RLSバイパス関数を使用）

