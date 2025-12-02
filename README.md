# 文化祭シフト管理システム

文化祭スタッフのシフト管理を行うためのPWA（Progressive Web App）アプリケーションです。リアルタイム同期、プッシュ通知、オフライン対応などの機能を備えています。

## 📋 目次

- [主な機能](#主な機能)
- [技術スタック](#技術スタック)
- [セットアップ](#セットアップ)
- [環境変数](#環境変数)
- [データベースセットアップ](#データベースセットアップ)
- [Firebase設定](#firebase設定)
- [Google Apps Script設定](#google-apps-script設定)
- [開発](#開発)
- [ビルドとデプロイ](#ビルドとデプロイ)
- [アーキテクチャ](#アーキテクチャ)
- [トラブルシューティング](#トラブルシューティング)

## ✨ 主な機能

### 認証・ユーザー管理
- **Supabase認証**: メールアドレスとパスワードによる認証
- **ロールベースアクセス制御**: `admin`（管理者）と`staff`（スタッフ）の2つのロール
- **ユーザー管理**: 管理者によるスタッフアカウントの作成・管理
- **ログイン状態の永続化**: ローカルストレージによるログイン状態の保持（5日間有効）

### シフト管理
- **カレンダー表示**: 週・月・日ビューでのシフト表示（デスクトップ）
- **モバイル対応カレンダー**: タッチ操作に最適化されたカスタムカレンダー
- **表形式表示**: 全スタッフのシフトを一覧表示
- **シフト作成・編集**: 管理者によるシフトの追加・編集・削除
- **一括登録**: 複数スタッフへの同時シフト登録
- **統括者設定**: 各シフトに統括者を設定可能
- **シフト詳細**: 仕事内容の詳細メモ機能
- **重複チェック**: 同じ時間帯のシフト重複を自動検出

### ダッシュボード
- **個人シフト表示**: 自分のシフトのみを表示
- **次のシフト表示**: 次回のシフトを強調表示
- **シフト詳細モーダル**: 同じ時間帯の同僚情報を表示
- **リアルタイム更新**: Supabase Realtimeによる自動同期

### プッシュ通知
- **Firebase Cloud Messaging**: Web Push通知の送信
- **管理者からの通知**: 選択したスタッフへの一斉通知
- **自動再試行**: FCMトークン取得失敗時の自動再試行（最大3回）
- **トークン管理**: ログイン時に自動登録、ログアウト時に自動削除
- **重複通知防止**: 同じ通知が複数回表示されない仕組み
- **無効トークン自動削除**: GAS側で無効なトークンを自動クリーンアップ

### PWA機能
- **オフライン対応**: Service Workerによるキャッシュ機能
- **ホーム画面追加**: iOS/AndroidでのPWAインストール対応
- **自動更新通知**: アプリ更新時のユーザー承認ベースの更新
- **iOS 16.4+対応**: iOS SafariでのWeb Push通知サポート

## 🛠 技術スタック

### フロントエンド
- **Next.js 16.0.5** (App Router)
- **React 19.2.0**
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
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
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
3. Settings → API から `URL` と `anon public` キーを取得

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
database/nazuna-fes.sql

-- 2. マイグレーション（順次実行）
database/migration_add_shift_description.sql
database/migration_add_supervisor.sql
database/migration_add_push_notifications.sql
database/migration_add_app_updates.sql
database/migration_fix_push_subscriptions.sql
```

### データベース構造

#### `profiles` テーブル
- `id` (UUID, PK): ユーザーID（auth.usersと連携）
- `display_name` (TEXT): 表示名
- `role` (TEXT): 'admin' または 'staff'
- `created_at` (TIMESTAMP): 作成日時

#### `shifts` テーブル
- `id` (UUID, PK): シフトID
- `user_id` (UUID, FK): スタッフID
- `title` (TEXT): 仕事内容
- `start_time` (TIMESTAMP): 開始時刻
- `end_time` (TIMESTAMP): 終了時刻
- `supervisor_id` (UUID, FK, nullable): 統括者ID
- `description` (TEXT, nullable): 詳細メモ
- `created_at` (TIMESTAMP): 作成日時

#### `push_subscriptions` テーブル
- `id` (UUID, PK): サブスクリプションID
- `user_id` (UUID, FK): ユーザーID
- `token` (TEXT, UNIQUE): FCMトークン
- `created_at` (TIMESTAMP): 作成日時

#### `notifications` テーブル
- `id` (UUID, PK): 通知ID
- `target_user_id` (UUID, FK): 送信先ユーザーID
- `title` (TEXT): 通知タイトル
- `body` (TEXT): 通知本文
- `scheduled_at` (TIMESTAMP, nullable): 送信予定時刻
- `sent_at` (TIMESTAMP, nullable): 送信完了時刻
- `created_by` (UUID, FK, nullable): 作成者ID
- `created_at` (TIMESTAMP): 作成日時

#### `app_updates` テーブル
- `id` (UUID, PK): 更新ID
- `version` (TEXT): バージョン文字列
- `triggered_by` (UUID, FK, nullable): トリガーしたユーザーID
- `created_at` (TIMESTAMP): 作成日時

### Row Level Security (RLS)

すべてのテーブルでRLSが有効化されており、適切なポリシーが設定されています：

- **profiles**: 全員閲覧可能、自分のプロフィールのみ編集可能
- **shifts**: 全員閲覧可能、管理者のみ編集可能
- **push_subscriptions**: 自分のトークンのみ管理可能
- **notifications**: 管理者のみ作成可能、自分宛の通知のみ閲覧可能

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

1. 管理者が管理画面で通知を作成
2. `notifications`テーブルにレコードが追加される
3. GASの`processNotifications`が1分ごとに実行
4. `scheduled_at <= now()`かつ`sent_at IS NULL`の通知を取得
5. 対象ユーザーのFCMトークンを取得
6. Firebase Cloud Messaging経由で通知を送信
7. `sent_at`を更新して送信済みマーク

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
│   ├── admin/             # 管理者ページ
│   ├── dashboard/         # スタッフダッシュボード
│   ├── api/               # API Routes
│   └── page.tsx           # ログインページ
├── components/            # Reactコンポーネント
│   ├── AdminCalendar.tsx  # 管理者用カレンダー
│   ├── ScheduleTimetable.tsx  # タイムテーブル
│   ├── PushNotificationManager.tsx  # 通知管理
│   └── ...
├── lib/                   # ユーティリティ・ライブラリ
│   ├── supabase.ts       # Supabaseクライアント
│   ├── firebaseClient.ts # Firebase設定
│   └── types.ts          # TypeScript型定義
├── backend/               # Google Apps Script
│   └── Code.gs           # 通知送信スクリプト
├── database/              # データベーススキーマ
│   ├── nazuna-fes.sql    # 基本スキーマ
│   └── migration_*.sql    # マイグレーション
├── public/                # 静的ファイル
│   ├── manifest.json     # PWAマニフェスト
│   └── firebase-messaging-sw.js  # FCM Service Worker
└── scripts/               # ビルドスクリプト
    ├── generate-icons.js  # アイコン生成
    └── generate-firebase-sw.js  # Firebase SW生成
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
3. 環境変数を設定
4. デプロイ

### 環境変数の設定（Vercel）

Vercel Dashboard → Settings → Environment Variables で以下を設定：

- すべての`NEXT_PUBLIC_*`環境変数
- ビルド時に`generate-firebase-sw.js`が実行されるため、Firebase設定も必要

### デプロイ後の確認事項

1. ✅ PWAマニフェストが正しく読み込まれているか
2. ✅ Service Workerが登録されているか
3. ✅ Firebase Service Workerが正しく生成されているか
4. ✅ プッシュ通知の権限要求が動作するか
5. ✅ GASトリガーが正しく設定されているか

## 🏛 アーキテクチャ

### 認証フロー

1. ユーザーがログインページでメールアドレスとパスワードを入力
2. Supabase Authで認証
3. 認証成功後、`setupPushNotificationsForUser`が呼び出される
4. 通知権限を要求し、FCMトークンを取得
5. `push_subscriptions`テーブルにトークンを保存
6. ローカルストレージにログイン情報を保存

### シフト管理フロー

1. 管理者がカレンダー上で日付をクリック
2. `ShiftModal`が開き、シフト情報を入力
3. Supabaseにシフトを保存
4. Supabase Realtimeが変更を検知
5. 全クライアントが自動的に更新

### 通知送信フロー

1. 管理者が通知を作成（`AdminNotifications`コンポーネント）
2. `notifications`テーブルにレコードが追加
3. GASの`processNotifications`が1分ごとに実行
4. 送信対象の通知を取得
5. 対象ユーザーのFCMトークンを取得（重複トークンは自動削除）
6. Firebase Cloud Messaging経由で送信
7. 送信済みマーク（`sent_at`更新）

### PWA更新フロー

1. 管理者が「キャッシュをリセット」ボタンをクリック
2. `app_updates`テーブルに新しいバージョンレコードを追加
3. クライアント側の`PwaUpdateListener`が30秒ごとにポーリング
4. 新しいバージョンを検知
5. ユーザーに更新バナーを表示
6. ユーザーが「今すぐ更新」をクリック
7. Service Workerとキャッシュをクリアして再読み込み

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

### プッシュ通知が届かない

- ✅ 通知権限が許可されているか確認
- ✅ `push_subscriptions`テーブルにトークンが登録されているか
- ✅ GASのトリガーが正しく設定されているか
- ✅ GASのログでエラーが出ていないか確認
- ✅ iOSの場合はPWAとしてインストールされているか（iOS 16.4+）

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
- ✅ マイグレーションがすべて実行されているか
- ✅ Supabase Dashboardのログでエラーを確認

### GASの通知送信が動作しない

- ✅ スクリプトプロパティがすべて設定されているか
- ✅ Firebaseサービスアカウントの権限が正しいか
- ✅ トリガーが正しく設定されているか
- ✅ GASの実行ログでエラーを確認

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

## 📝 ライセンス

このプロジェクトMIT Licenceで公開されています。

---

**注意**: 本番環境にデプロイする前に、必ず環境変数とデータベース設定を確認してください。
