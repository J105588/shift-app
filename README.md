# 文化祭シフト管理システム

文化祭スタッフのシフト管理を行うためのPWA（Progressive Web App）アプリケーションです。リアルタイム同期、プッシュ通知、オフライン対応、メンテナンスモード、団体付与シフト機能などを備えています。

## 📋 目次

- [主な機能](#主な機能)
- [技術スタック](#技術スタック)
- [セットアップ](#セットアップ)
- [環境変数](#環境変数)
- [データベースセットアップ](#データベースセットアップ)
- [Firebase設定](#firebase設定)
- [Google Apps Script設定](#google-apps-script設定)
- [APIエンドポイント](#apiエンドポイント)
- [コンポーネント一覧](#コンポーネント一覧)
- [開発](#開発)
- [ビルドとデプロイ](#ビルドとデプロイ)
- [アーキテクチャ](#アーキテクチャ)
- [トラブルシューティング](#トラブルシューティング)

## ✨ 主な機能

### 認証・ユーザー管理

- **Supabase認証**: メールアドレスとパスワードによる認証
- **ロールベースアクセス制御**: `admin`（管理者）と`staff`（スタッフ）の2つのロール
- **ユーザー管理**: 管理者によるスタッフアカウントの作成・編集・管理
  - 新規ユーザー作成（表示名、メールアドレス、パスワード、権限の設定）
  - 既存ユーザー情報の編集（表示名、メールアドレス、権限の変更）
  - ユーザー一覧表示（メールアドレス、権限、登録日を含む）
- **ログイン状態の永続化**: ローカルストレージによるログイン状態の保持（5日間有効）
- **メンテナンスモード**: 管理者がシステムをメンテナンスモードに設定可能（一般ユーザーはアクセス不可、管理者は引き続きアクセス可能）

### シフト管理

#### 個別付与シフト

- **シフト作成・編集**: 管理者による個別スタッフへのシフト追加・編集・削除
- **一括登録**: 複数スタッフへの同時シフト登録（同じ業務内容または個別設定）
- **統括者設定**: 各シフトに統括者を設定可能（個別付与シフト用）
- **シフト詳細**: 仕事内容の詳細メモ機能
- **重複チェック**: 同じ時間帯のシフト重複を自動検出（個別付与シフトと団体付与シフトの両方をチェック）

#### 団体付与シフト（新機能）

- **団体シフト作成**: 複数のスタッフを一度に同じシフトに割り当て
- **統括者設定**: 団体シフト内で統括者を1名指定（必須）
- **参加者管理**: チェックボックスで複数スタッフを選択
- **自動通知**: 各参加者に対してシフト開始の1時間前、30分前、5分前に自動通知
- **シフト詳細表示**: 団体シフトの参加者全員と統括者を表示
- **統括者の権限**: 統括者は自分の団体シフトの詳細メモを編集可能
- **重複チェック**: 団体付与シフトと個別付与シフトの重複を自動検出

#### カレンダー表示

- **週・月・日ビュー**: デスクトップ向けのカレンダー表示（react-big-calendar）
- **モバイル対応カレンダー**: タッチ操作に最適化されたカスタムカレンダー
- **表形式表示**: 全スタッフのシフトを一覧表示（SpreadsheetView）
- **シフト詳細モーダル**: 同じ時間帯の同僚情報を表示

### ダッシュボード

- **個人シフト表示**: 自分のシフトのみを表示（個別付与と団体付与の両方）
- **次のシフト表示**: 次回のシフトを強調表示
- **シフト詳細モーダル**: 
  - 個別付与シフト: 同じ時間帯の同僚情報を表示
  - 団体付与シフト: 参加者全員と統括者を表示
- **リアルタイム更新**: Supabase Realtimeによる自動同期（shifts、shift_groups、shift_assignmentsの変更を監視）
- **メンテナンスモード自動検知**: 5秒ごとにメンテナンスモードをチェックし、有効な場合は自動的にメンテナンスページへリダイレクト

### プッシュ通知

#### 管理者からの通知

- **ユーザー選択**: 個別にスタッフを選択して通知を送信
- **グループ選択（新機能）**: 団体シフト単位で通知を送信
  - 未終了の団体シフトが自動的にグループとして表示
  - グループ名形式: `MMDD-HHMM-HHMM-仕事名`（例: `0921-1100-1230-受付`）
  - 選択したグループの全参加者に一括通知
  - シフト終了後は自動的にグループ一覧から除外
- **スケジュール通知**: 指定した日時に通知を送信可能
- **リアルタイム更新**: グループ一覧がリアルタイムで更新

#### 自動通知

- **シフト開始前通知**: シフト開始の1時間前、30分前、5分前に自動通知
  - 個別付与シフト: 各スタッフに個別に通知
  - 団体付与シフト: 各参加者に個別に通知
- **通知削除**: シフト削除時に関連する未送信通知を自動削除

#### 通知機能全般

- **Firebase Cloud Messaging**: Web Push通知の送信
- **自動再試行**: FCMトークン取得失敗時の自動再試行（最大3回）
- **トークン管理**: ログイン時に自動登録、ログアウト時に自動削除
- **重複通知防止**: 同じ通知が複数回表示されない仕組み
- **無効トークン自動削除**: GAS側で無効なトークンを自動クリーンアップ
- **シフト通知リンク**: 通知からシフト詳細ページへ直接遷移可能

### PWA機能

- **オフライン対応**: Service Workerによるキャッシュ機能
- **ホーム画面追加**: iOS/AndroidでのPWAインストール対応
- **自動更新通知**: アプリ更新時のユーザー承認ベースの更新
- **iOS 16.4+対応**: iOS SafariでのWeb Push通知サポート
- **強制更新機能**: 管理者が全端末に最新バージョンの適用を通知可能

### システム管理

- **メンテナンスモード**: システム全体をメンテナンスモードに設定可能
- **PWAキャッシュリセット**: 全端末のキャッシュを強制的にクリア
- **システム設定管理**: `app_settings`テーブルによる設定管理

## 🛠 技術スタック

### フロントエンド

- **Next.js 16.0.7** (App Router)
- **React 19.2.1**
- **TypeScript 5**
- **Tailwind CSS 4.1.17**
- **react-big-calendar 1.19.4** (カレンダー表示)
- **date-fns 4.1.0** (日付処理)
- **lucide-react 0.555.0** (アイコン)

### バックエンド・インフラ

- **Supabase**: 認証・データベース・Realtime
  - PostgreSQL (データベース)
  - Row Level Security (RLS)
  - Realtime subscriptions
  - Service Role Key（管理者API用）
- **Firebase Cloud Messaging**: プッシュ通知
- **Google Apps Script**: 通知送信バックエンド

### PWA

- **next-pwa 5.6.0**: PWA機能の実装
- **Service Worker**: オフライン対応・プッシュ通知

## 🚀 セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn
- Supabaseアカウント
- Firebaseプロジェクト
- Google Apps Scriptプロジェクト

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd shift-app
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定します（詳細は[環境変数](#環境変数)セクションを参照）：

```bash
cp .env.example .env.local
# .env.localを編集
```

### 4. Firebase Service Workerの生成

```bash
npm run generate-firebase-sw
```

### 5. アイコンの生成（オプション）

```bash
npm run generate-icons
```

## 🔐 環境変数

`.env.local`ファイルに以下の環境変数を設定してください：

### Supabase設定

```bash
# 公開設定（クライアント側で使用）
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# サーバー側設定（API Routes用、本番環境ではVercelの環境変数として設定）
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 管理者機能用の認証パスワード（強制ログアウト機能で使用）
ADMIN_FORCE_LOGOUT_PASSWORD=your_secure_password_here
```

### Firebase設定

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_firebase_vapid_key
```

### 環境変数の取得方法

#### Supabase

1. [Supabase Dashboard](https://app.supabase.com/)にログイン
2. プロジェクトを選択
3. Settings → API から以下を取得：
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` キー → `SUPABASE_SERVICE_ROLE_KEY`（**重要**: このキーは秘密にしてください）

#### Firebase

1. [Firebase Console](https://console.firebase.google.com/)にログイン
2. プロジェクトを選択
3. Project Settings → General → Your apps → Web app から設定値を取得
4. Cloud Messaging → Web Push certificates からVAPIDキーを生成

## 🗄 データベースセットアップ

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/)でアカウント作成
2. 新しいプロジェクトを作成

### 2. データベーススキーマの適用

Supabase DashboardのSQL Editorで、以下の順序でSQLファイルを実行：

```sql
-- 1. 基本スキーマ
-- database/nazuna-fes.sql を実行

-- 2. マイグレーション（順次実行）
-- database/migration_add_shift_description.sql
-- database/migration_add_supervisor.sql
-- database/migration_add_push_notifications.sql
-- database/migration_add_shift_notification_link.sql
-- database/migration_add_app_updates.sql
-- database/migration_add_system_settings.sql
-- database/migration_fix_push_subscriptions.sql
-- database/migration_fix_push_subscriptions_rls.sql
-- database/migration_admin_update_profiles.sql（管理者がユーザーを編集できるようにする）
-- database/migration_supervisor_edit_description.sql（統括者がシフトのメモを編集できるようにする）
-- database/migration_shift_groups.sql（団体付与シフト機能）
-- database/migration_add_shift_group_notification_link.sql（団体付与シフトの通知リンク）
```

### データベース構造

#### `profiles` テーブル
- `id` (UUID, PK): ユーザーID（auth.usersと連携）
- `display_name` (TEXT): 表示名
- `role` (TEXT): 'admin' または 'staff'（CHECK制約）
- `created_at` (TIMESTAMP): 作成日時

**RLSポリシー:**
- 全員が閲覧可能
- ユーザーは自分のプロフィールのみ作成・編集可能
- 管理者は全ユーザーのプロフィールを編集可能

#### `shifts` テーブル（個別付与シフト）
- `id` (UUID, PK): シフトID
- `user_id` (UUID, FK): スタッフID（profiles.id参照）
- `title` (TEXT): 仕事内容
- `start_time` (TIMESTAMP): 開始時刻
- `end_time` (TIMESTAMP): 終了時刻
- `supervisor_id` (UUID, FK, nullable): 統括者ID（profiles.id参照）
- `description` (TEXT, nullable): 詳細メモ
- `created_at` (TIMESTAMP): 作成日時

**RLSポリシー:**
- 全員が閲覧可能
- 管理者のみ追加・編集・削除可能
- 統括者は自分のシフトの`description`のみ更新可能

#### `shift_groups` テーブル（団体付与シフト）
- `id` (UUID, PK): シフトグループID
- `title` (TEXT): 業務内容
- `start_time` (TIMESTAMP): 開始時刻
- `end_time` (TIMESTAMP): 終了時刻
- `description` (TEXT, nullable): 詳細メモ
- `location` (TEXT, nullable): 場所（将来の拡張用）
- `created_at` (TIMESTAMP): 作成日時
- `updated_at` (TIMESTAMP): 更新日時

**RLSポリシー:**
- 全員が閲覧可能
- 管理者のみ追加・編集・削除可能
- 統括者は自分のシフトグループの`description`のみ更新可能

#### `shift_assignments` テーブル（団体付与シフトの参加者）
- `id` (UUID, PK): 割り当てID
- `shift_group_id` (UUID, FK): シフトグループID（shift_groups.id参照、CASCADE削除）
- `user_id` (UUID, FK): 参加者ID（profiles.id参照、CASCADE削除）
- `is_supervisor` (BOOLEAN): 統括者フラグ
- `created_at` (TIMESTAMP): 作成日時
- UNIQUE制約: `(shift_group_id, user_id)` - 同じシフトグループに同じユーザーを重複登録できない

**RLSポリシー:**
- 全員が閲覧可能
- 管理者のみ追加・編集・削除可能

#### `push_subscriptions` テーブル
- `id` (UUID, PK): サブスクリプションID
- `user_id` (UUID, FK): ユーザーID（profiles.id参照）
- `token` (TEXT, UNIQUE): FCMトークン
- `created_at` (TIMESTAMP): 作成日時

**RLSポリシー:**
- ユーザーは自分のトークンのみ管理可能

#### `notifications` テーブル
- `id` (UUID, PK): 通知ID
- `target_user_id` (UUID, FK): 送信先ユーザーID（profiles.id参照）
- `title` (TEXT): 通知タイトル
- `body` (TEXT): 通知本文
- `scheduled_at` (TIMESTAMP, nullable): 送信予定時刻（nullの場合は即時送信）
- `sent_at` (TIMESTAMP, nullable): 送信完了時刻
- `shift_id` (UUID, FK, nullable): 関連シフトID（shifts.id参照、CASCADE削除）
- `shift_group_id` (UUID, FK, nullable): 関連シフトグループID（shift_groups.id参照、CASCADE削除）
- `created_by` (UUID, FK, nullable): 作成者ID（profiles.id参照）
- `created_at` (TIMESTAMP): 作成日時

**RLSポリシー:**
- 管理者のみ作成・編集・削除可能
- ユーザーは自分宛の通知のみ閲覧可能

#### `app_updates` テーブル
- `id` (UUID, PK): 更新ID
- `version` (TEXT): バージョン文字列（タイムスタンプ）
- `triggered_by` (UUID, FK, nullable): トリガーしたユーザーID（profiles.id参照）
- `created_at` (TIMESTAMP): 作成日時

**RLSポリシー:**
- 全員が閲覧可能（端末側で更新チェック）
- 管理者のみ追加可能

#### `app_settings` テーブル
- `id` (UUID, PK): 設定ID
- `key` (TEXT, UNIQUE): 設定キー
- `value` (TEXT): 設定値
- `description` (TEXT, nullable): 説明
- `updated_by` (UUID, FK, nullable): 更新者ID（profiles.id参照）
- `updated_at` (TIMESTAMP): 更新日時

**RLSポリシー:**
- 全員が閲覧可能（メンテナンスモードチェックなど）
- 管理者のみ編集可能

**初期設定:**
- `maintenance_mode`: 'false'（メンテナンスモード無効）

### Row Level Security (RLS)

すべてのテーブルでRLSが有効化されており、適切なポリシーが設定されています：

- **profiles**: 全員閲覧可能、自分のプロフィールのみ編集可能（管理者は全ユーザー編集可能）
- **shifts**: 全員閲覧可能、管理者のみ編集可能
- **shift_groups**: 全員閲覧可能、管理者のみ編集可能（統括者はdescriptionのみ更新可能）
- **shift_assignments**: 全員閲覧可能、管理者のみ編集可能
- **push_subscriptions**: 自分のトークンのみ管理可能
- **notifications**: 管理者のみ作成可能、自分宛の通知のみ閲覧可能
- **app_updates**: 全員閲覧可能、管理者のみ追加可能
- **app_settings**: 全員閲覧可能、管理者のみ編集可能

## 🔥 Firebase設定

### 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/)でプロジェクト作成
2. Webアプリを追加
3. 設定値を`.env.local`に設定

### 2. Cloud Messaging設定

1. Firebase Console → Project Settings → Cloud Messaging
2. **Web Push certificates**でVAPIDキーを生成
3. VAPIDキーを`.env.local`の`NEXT_PUBLIC_FIREBASE_VAPID_KEY`に設定

### 3. Service Workerファイルの生成

ビルド時に自動生成されますが、手動で生成する場合：

```bash
npm run generate-firebase-sw
```

`public/firebase-messaging-sw.js`が生成されます。

## 📧 Google Apps Script設定

### 1. GASプロジェクトの作成

1. [Google Apps Script](https://script.google.com/)で新しいプロジェクトを作成
2. `backend/Code.gs`の内容をコピー＆ペースト

### 2. スクリプトプロパティの設定

Apps Scriptエディタで：
1. プロジェクトの設定（歯車アイコン）→ スクリプトプロパティ
2. 以下のプロパティを追加：

| プロパティ名 | 説明 |
|------------|------|
| `SUPABASE_URL` | SupabaseプロジェクトURL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key（RLSをバイパス） |
| `FCM_PROJECT_ID` | FirebaseプロジェクトID |
| `FCM_SA_CLIENT_EMAIL` | Firebaseサービスアカウントのメールアドレス |
| `FCM_SA_PRIVATE_KEY` | Firebaseサービスアカウントの秘密鍵（`-----BEGIN...`から`...END-----`まで全て） |

### 3. Firebaseサービスアカウントの取得

1. Firebase Console → Project Settings → Service accounts
2. **Generate new private key**をクリック
3. ダウンロードしたJSONファイルから`client_email`と`private_key`を取得

### 4. トリガーの設定

1. Apps Scriptエディタで時計アイコン（トリガー）をクリック
2. **トリガーを追加**
3. 設定：
   - 実行する関数: `processNotifications`
   - イベントのソース: 時間主導型
   - 時間ベースのトリガー: 分ベースのタイマー
   - 時間の間隔: 1分おき

### 5. 通知送信の仕組み

1. 管理者が管理画面で通知を作成（`AdminNotifications`コンポーネント）
2. `notifications`テーブルにレコードが追加
3. GASの`processNotifications`が1分ごとに実行
4. `scheduled_at <= now()`かつ`sent_at IS NULL`の通知を取得
5. 対象ユーザーのFCMトークンを取得（重複トークンは自動削除）
6. Firebase Cloud Messaging経由で通知を送信
7. `sent_at`を更新して送信済みマーク

## 🔌 APIエンドポイント

### `/api/admin/create-user` (POST)

新規ユーザーを作成します。

**リクエスト:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "ユーザー名",
  "role": "staff" | "admin"
}
```

**レスポンス:**
```json
{
  "success": true,
  "user": { ... },
  "message": "ユーザーを作成しました"
}
```

**機能:**
- 既存ユーザーのメールアドレスをチェック
- 既存ユーザーの場合、プロフィールを更新
- 新規ユーザーの場合、auth.usersとprofilesテーブルに作成

### `/api/admin/update-user` (PUT)

既存ユーザーの情報を更新します。

**リクエスト:**
```json
{
  "userId": "user-uuid",
  "email": "newemail@example.com",
  "displayName": "新しい名前",
  "role": "admin"
}
```

**レスポンス:**
```json
{
  "success": true,
  "user": { ... },
  "message": "ユーザー情報を更新しました"
}
```

**機能:**
- メールアドレスの更新（重複チェック付き）
- 表示名の更新
- 権限の更新
- auth.usersとprofilesテーブルの両方を更新

### `/api/admin/get-users` (GET)

全ユーザー一覧を取得します（メールアドレス含む）。

**レスポンス:**
```json
{
  "success": true,
  "users": [
    {
      "id": "uuid",
      "display_name": "ユーザー名",
      "role": "staff",
      "email": "user@example.com",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**機能:**
- profilesテーブルとauth.usersテーブルを結合
- メールアドレスを含む完全なユーザー情報を返す

## 🧩 コンポーネント一覧

### ページコンポーネント

- **`app/page.tsx`**: ログインページ
- **`app/admin/page.tsx`**: 管理者ダッシュボード（カレンダー、ユーザー管理、通知、設定のタブ）
- **`app/dashboard/page.tsx`**: スタッフ用ダッシュボード（個人シフト表示）
- **`app/maintenance/page.tsx`**: メンテナンスモード表示ページ

### 管理機能コンポーネント

- **`components/UserManagement.tsx`**: ユーザー管理（作成・編集・一覧表示）
- **`components/AdminCalendar.tsx`**: 管理者用カレンダー表示
- **`components/AdminNotifications.tsx`**: 通知作成・管理（ユーザー選択・グループ選択）
- **`components/AdminSettings.tsx`**: システム設定（メンテナンスモード、PWA更新）

### シフト管理コンポーネント

- **`components/ShiftModal.tsx`**: シフト作成・編集モーダル（個別付与・団体付与対応）
- **`components/ShiftDetailModal.tsx`**: シフト詳細表示モーダル（個別付与・団体付与対応）
- **`components/ScheduleTimetable.tsx`**: タイムテーブル表示
- **`components/SpreadsheetView.tsx`**: 表形式シフト表示

### PWA・通知コンポーネント

- **`components/PushNotificationManager.tsx`**: プッシュ通知管理
- **`components/FcmTokenManager.tsx`**: FCMトークン管理
- **`components/PwaInstallPrompt.tsx`**: PWAインストールプロンプト
- **`components/PwaUpdateListener.tsx`**: PWA更新検知
- **`components/PwaDebugInfo.tsx`**: PWAデバッグ情報表示

### 共通コンポーネント

- **`components/Navbar.tsx`**: ナビゲーションバー
- **`components/ToastProvider.tsx`**: トースト通知プロバイダー
- **`components/NotificationToast.tsx`**: 通知トースト表示
- **`components/ClientProviders.tsx`**: クライアント側プロバイダー

## 💻 開発

### 開発サーバーの起動

```bash
npm run dev
```

開発モードではPWA機能は無効です。PWA機能をテストするには本番ビルドが必要です。

### コード品質チェック

```bash
npm run lint
```

### 主要なディレクトリ構造

```
shift-app/
├── app/                    # Next.js App Router
│   ├── admin/              # 管理者ページ
│   │   └── page.tsx
│   ├── dashboard/          # スタッフダッシュボード
│   │   └── page.tsx
│   ├── maintenance/       # メンテナンスページ
│   │   └── page.tsx
│   ├── api/               # API Routes
│   │   └── admin/
│   │       ├── create-user/
│   │       ├── update-user/
│   │       └── get-users/
│   ├── globals.css        # グローバルスタイル
│   ├── layout.tsx         # ルートレイアウト
│   └── page.tsx           # ログインページ
├── components/            # Reactコンポーネント
│   ├── AdminCalendar.tsx
│   ├── AdminNotifications.tsx
│   ├── AdminSettings.tsx
│   ├── UserManagement.tsx
│   ├── ScheduleTimetable.tsx
│   ├── ShiftDetailModal.tsx
│   ├── ShiftModal.tsx
│   ├── SpreadsheetView.tsx
│   ├── PushNotificationManager.tsx
│   ├── FcmTokenManager.tsx
│   ├── PwaInstallPrompt.tsx
│   ├── PwaUpdateListener.tsx
│   ├── PwaDebugInfo.tsx
│   ├── Navbar.tsx
│   ├── ToastProvider.tsx
│   ├── NotificationToast.tsx
│   └── ClientProviders.tsx
├── lib/                   # ユーティリティ・ライブラリ
│   ├── supabase.ts       # Supabaseクライアント
│   ├── firebaseClient.ts # Firebase設定
│   ├── pwa.ts            # PWAユーティリティ
│   ├── toast.ts          # トースト通知
│   └── types.ts          # TypeScript型定義
├── backend/               # Google Apps Script
│   └── Code.gs           # 通知送信スクリプト
├── database/              # データベーススキーマ
│   ├── nazuna-fes.sql    # 基本スキーマ
│   ├── auto.sql          # 自動トリガー設定
│   └── migration_*.sql   # マイグレーション
├── public/                # 静的ファイル
│   ├── manifest.json     # PWAマニフェスト
│   ├── firebase-messaging-sw.js  # FCM Service Worker
│   └── icon-*.png         # PWAアイコン
├── scripts/               # ビルドスクリプト
│   ├── generate-icons.js
│   └── generate-firebase-sw.js
├── docs/                  # ドキュメント
│   ├── PWA_使用方法.md
│   ├── iOS_PWA_設定ガイド.md
│   ├── iOS_PWA_トラブルシューティング.md
│   └── CSS確認方法.md
├── next.config.ts         # Next.js設定
├── package.json
└── tsconfig.json
```

## 🏗 ビルドとデプロイ

### 本番ビルド

```bash
npm run build
```

### 本番サーバーの起動

```bash
npm start
```

### Vercelへのデプロイ

1. [Vercel](https://vercel.com/)にログイン
2. プロジェクトをインポート
3. 環境変数を設定（以下を参照）
4. デプロイ

### 環境変数の設定（Vercel）

Vercel Dashboard → Settings → Environment Variables で以下を設定：

**必須環境変数:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（**重要**: Production環境のみに設定）
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

**注意:**
- `SUPABASE_SERVICE_ROLE_KEY`はサーバー側でのみ使用されるため、Production環境のみに設定してください
- ビルド時に`generate-firebase-sw.js`が実行されるため、Firebase設定も必要です

### デプロイ後の確認事項

1. ✅ PWAマニフェストが正しく読み込まれているか
2. ✅ Service Workerが登録されているか
3. ✅ Firebase Service Workerが正しく生成されているか
4. ✅ プッシュ通知の権限要求が動作するか
5. ✅ GASトリガーが正しく設定されているか
6. ✅ メンテナンスモードが動作するか
7. ✅ ユーザー管理機能が動作するか
8. ✅ 団体付与シフト機能が動作するか
9. ✅ グループ選択による通知配信が動作するか

## 🏛 アーキテクチャ

### 認証フロー

1. ユーザーがログインページでメールアドレスとパスワードを入力
2. Supabase Authで認証
3. 認証成功後、`setupPushNotificationsForUser`が呼び出される
4. 通知権限を要求し、FCMトークンを取得
5. `push_subscriptions`テーブルにトークンを保存（既存トークンは削除）
6. ローカルストレージにログイン情報を保存
7. プロフィールのroleを確認し、`admin`の場合は`/admin`へ、`staff`の場合は`/dashboard`へリダイレクト
8. メンテナンスモードをチェックし、有効な場合は一般ユーザーを`/maintenance`へリダイレクト

### シフト管理フロー

#### 個別付与シフト

1. 管理者がカレンダー上で日付をクリック
2. `ShiftModal`が開き、「個別付与」モードを選択
3. シフト情報を入力（担当者、業務内容、時間、統括者など）
4. Supabaseの`shifts`テーブルに保存
5. 自動通知を作成（1時間前、30分前、5分前）
6. Supabase Realtimeが変更を検知
7. 全クライアントが自動的に更新

#### 団体付与シフト

1. 管理者がカレンダー上で日付をクリック
2. `ShiftModal`が開き、「団体付与」モードを選択（デフォルト）
3. 参加者を複数選択
4. 統括者を選択（必須）
5. 業務内容、時間、詳細メモを入力
6. `shift_groups`テーブルにシフトグループを作成
7. `shift_assignments`テーブルに各参加者を登録（統括者フラグ付き）
8. 各参加者に対して自動通知を作成（1時間前、30分前、5分前）
9. Supabase Realtimeが変更を検知（shift_groups、shift_assignments）
10. 全クライアントが自動的に更新

### 通知送信フロー

#### 管理者からの通知

1. 管理者が通知を作成（`AdminNotifications`コンポーネント）
   - **ユーザー選択モード**: 個別にスタッフを選択
   - **グループ選択モード**: 未終了の団体シフトをグループとして選択
2. `notifications`テーブルにレコードが追加
3. GASの`processNotifications`が1分ごとに実行
4. `scheduled_at <= now()`かつ`sent_at IS NULL`の通知を取得
5. 対象ユーザーのFCMトークンを取得（重複トークンは自動削除）
6. Firebase Cloud Messaging経由で通知を送信
7. 送信済みマーク（`sent_at`更新）

#### 自動通知（シフト開始前）

1. シフト作成時（個別付与・団体付与の両方）に`createShiftNotifications`が呼び出される
2. 各参加者に対して3つの通知を作成（1時間前、30分前、5分前）
3. `notifications`テーブルに`shift_id`または`shift_group_id`を関連付け
4. GASが1分ごとに実行され、送信時刻が来たら通知を送信
5. シフト削除時に関連する未送信通知を自動削除

### PWA更新フロー

1. 管理者が「キャッシュをリセット」ボタンをクリック（`AdminSettings`コンポーネント）
2. `app_updates`テーブルに新しいバージョンレコードを追加
3. クライアント側の`PwaUpdateListener`が30秒ごとにポーリング
4. 新しいバージョンを検知
5. ユーザーに更新バナーを表示
6. ユーザーが「今すぐ更新」をクリック
7. Service Workerとキャッシュをクリアして再読み込み

### メンテナンスモードフロー

1. 管理者が`AdminSettings`でメンテナンスモードを有効化
2. `app_settings`テーブルの`maintenance_mode`が`true`に更新
3. 一般ユーザーがダッシュボードにアクセス
4. `dashboard/page.tsx`が5秒ごとにメンテナンスモードをチェック
5. メンテナンスモードが有効な場合、`/maintenance`へリダイレクト
6. メンテナンスページは5秒ごとにメンテナンスモードをチェック
7. メンテナンスモードが解除されると、自動的に`/dashboard`へリダイレクト

### ユーザー管理フロー

#### ユーザー作成

1. 管理者が`UserManagement`コンポーネントでフォームに入力
2. `/api/admin/create-user`にPOSTリクエスト
3. 既存ユーザーをチェック
4. 新規ユーザーの場合：
   - `auth.admin.createUser`でauth.usersに作成
   - `profiles`テーブルにupsert
5. 既存ユーザーの場合：
   - `profiles`テーブルを更新

#### ユーザー編集

1. 管理者がユーザー一覧の「編集」ボタンをクリック
2. 編集モーダルが開き、現在の情報が表示
3. 情報を編集して「更新する」をクリック
4. `/api/admin/update-user`にPUTリクエスト
5. メールアドレスの重複チェック
6. `auth.admin.updateUserById`でauth.usersを更新
7. `profiles`テーブルを更新
8. ユーザー一覧を再取得

### トークン管理

- **ログイン時**: 新しいFCMトークンを取得し、同じ`user_id`の古いトークンを削除
- **ログアウト時**: ローカルストレージのトークンを取得し、DBから削除
- **GAS側**: 通知送信時に同じ`user_id`で複数トークンがある場合、最新の1つだけを残す
- **自動クリーンアップ**: 5日以上ログインがない端末のトークンを自動削除

## 🐛 トラブルシューティング

### PWAが動作しない

- ✅ 本番ビルド（`npm run build && npm start`）で起動しているか確認
- ✅ HTTPSまたはlocalhostでアクセスしているか確認
- ✅ Service Workerが登録されているか（開発者ツール → Application → Service Workers）
- ✅ `next.config.ts`でPWAが有効になっているか確認

### プッシュ通知が届かない

- ✅ 通知権限が許可されているか確認
- ✅ `push_subscriptions`テーブルにトークンが登録されているか
- ✅ GASのトリガーが正しく設定されているか
- ✅ GASのログでエラーが出ていないか確認
- ✅ iOSの場合はPWAとしてインストールされているか（iOS 16.4+）
- ✅ Firebase設定が正しいか確認

### FCMトークン取得エラー

- ✅ Firebase設定が正しいか確認
- ✅ Service Workerが正しく登録されているか
- ✅ `NEXT_PUBLIC_FIREBASE_VAPID_KEY`が設定されているか
- ✅ 自動再試行が実行されるため、しばらく待つ

### 通知が重複して届く

- ✅ 最新のコードがデプロイされているか確認
- ✅ ブラウザのキャッシュをクリア
- ✅ `push_subscriptions`テーブルに同じトークンが重複していないか確認

### データベースエラー

- ✅ SupabaseのRLSポリシーが正しく設定されているか
- ✅ マイグレーションがすべて実行されているか（特に`migration_shift_groups.sql`）
- ✅ Supabase Dashboardのログでエラーを確認
- ✅ `SUPABASE_SERVICE_ROLE_KEY`が正しく設定されているか（API Routes用）

### GASの通知送信が動作しない

- ✅ スクリプトプロパティがすべて設定されているか
- ✅ Firebaseサービスアカウントの権限が正しいか
- ✅ トリガーが正しく設定されているか
- ✅ GASの実行ログでエラーを確認

### ユーザー管理機能が動作しない

- ✅ `migration_admin_update_profiles.sql`が実行されているか
- ✅ `SUPABASE_SERVICE_ROLE_KEY`が設定されているか
- ✅ API Routesが正しくデプロイされているか
- ✅ ブラウザのコンソールでエラーを確認

### メンテナンスモードが動作しない

- ✅ `migration_add_system_settings.sql`が実行されているか
- ✅ `app_settings`テーブルに`maintenance_mode`レコードが存在するか
- ✅ ブラウザのコンソールでエラーを確認
- ✅ ページをリロードして確認

### 団体付与シフトが表示されない

- ✅ `migration_shift_groups.sql`が実行されているか
- ✅ `shift_groups`と`shift_assignments`テーブルが作成されているか
- ✅ RLSポリシーが正しく設定されているか
- ✅ ブラウザのコンソールでエラーを確認
- ✅ Supabase Realtimeが有効になっているか

### グループ選択による通知が送信されない

- ✅ `migration_add_shift_group_notification_link.sql`が実行されているか
- ✅ `notifications`テーブルに`shift_group_id`カラムが存在するか
- ✅ 選択したグループに参加者が存在するか
- ✅ GASのログでエラーを確認

## 📚 参考資料

### ドキュメント

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [PWA Documentation](https://web.dev/progressive-web-apps/)

### プロジェクト内ドキュメント

- `docs/PWA_使用方法.md`: PWAの詳細な使用方法
- `docs/iOS_PWA_設定ガイド.md`: iOSでのPWA設定ガイド
- `docs/iOS_PWA_トラブルシューティング.md`: iOS PWAのトラブルシューティング
- `docs/CSS確認方法.md`: CSSの確認方法

## 📝 ライセンス

このプロジェクトMIT Licenceで公開されています。

---

**注意**: 本番環境にデプロイする前に、必ず環境変数とデータベース設定を確認してください。特に`SUPABASE_SERVICE_ROLE_KEY`は機密情報のため、適切に管理してください。
