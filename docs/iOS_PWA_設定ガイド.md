# iOS PWA 設定ガイド

このアプリは iOS 16.4以降でPWAとして動作し、プッシュ通知をサポートしています。

## 📱 iOSでのPWAインストール方法

1. **Safariでアプリを開く**
   - iOSデバイスのSafariブラウザでアプリのURLにアクセス

2. **ホーム画面に追加**
   - Safariの下部にある共有ボタン（□↑）をタップ
   - 「ホーム画面に追加」を選択
   - 名前を確認して「追加」をタップ

3. **PWAとして起動**
   - ホーム画面に追加されたアイコンをタップ
   - フルスクリーンでアプリが起動します

## 🔔 プッシュ通知の設定

### 前提条件
- **iOS 16.4以降**が必要です
- PWAとしてホーム画面に追加されている必要があります
- Safariの設定で通知が許可されている必要があります

### 通知の許可手順

1. **アプリ内で通知を許可**
   - PWAとして起動したアプリで、通知の許可を求められたら「許可」をタップ

2. **iOS設定で確認**
   - iOSの「設定」→「Safari」→「通知」で、アプリがリストに表示されているか確認
   - 通知が「許可」になっていることを確認

3. **通知のテスト**
   - 管理者が通知を送信すると、ロック画面や通知センターに表示されます

## ⚙️ 技術的な詳細

### 実装内容

1. **manifest.json**
   - iOS向けのアイコンサイズ（180x180）を追加
   - `scope` と `categories` を設定

2. **Apple Touch Icon**
   - `/apple-touch-icon.png` (180x180) を生成
   - `/icon-180x180.png` も生成

3. **メタタグ**
   - `apple-mobile-web-app-capable`: PWAとして動作
   - `apple-mobile-web-app-status-bar-style`: ステータスバーのスタイル
   - `apple-mobile-web-app-title`: アプリ名

4. **Service Worker**
   - Firebase Cloud Messaging用のService Workerを登録
   - iOS 16.4以降で動作

5. **通知処理**
   - フォアグラウンド時: `Notification` APIを使用して通知を表示
   - バックグラウンド時: Service Workerが通知を表示

### 制限事項

- iOS 16.4未満ではWeb Push APIがサポートされていません
- iOSでは、PWAとしてホーム画面に追加する必要があります
- ブラウザ（Safari）で直接開いただけでは通知が動作しない場合があります
- iOSでは、通知のバッジやサウンドのカスタマイズが制限されています

## 🐛 トラブルシューティング

### 通知が届かない場合

1. **iOSバージョンを確認**
   - iOS 16.4以降であることを確認（設定 → 一般 → 情報）

2. **PWAとしてインストールされているか確認**
   - ホーム画面のアイコンから起動しているか確認
   - Safariのアドレスバーから直接開いている場合は動作しない可能性があります

3. **通知の許可を確認**
   - iOSの「設定」→「Safari」→「通知」で許可されているか確認

4. **Service Workerの状態を確認**
   - Safariの開発者ツール（Macからリモートデバッグ）でService Workerが登録されているか確認

5. **FCMトークンが取得できているか確認**
   - ブラウザのコンソールで「FCM token saved successfully」が表示されているか確認

### PWAがインストールできない場合

1. **HTTPS接続を確認**
   - iOSではHTTPS（またはlocalhost）が必要です

2. **manifest.jsonが正しく読み込まれているか確認**
   - Safariの開発者ツールでNetworkタブを確認

3. **アイコンが正しく表示されているか確認**
   - `/apple-touch-icon.png` が存在し、アクセス可能か確認

## 📚 参考資料

- [Apple Developer - Web Push Notifications](https://developer.apple.com/documentation/usernotifications/web_push_notifications)
- [Firebase Cloud Messaging - iOS Setup](https://firebase.google.com/docs/cloud-messaging/js/client)
- [MDN - Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

