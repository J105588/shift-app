# iOS PWA トラブルシューティングガイド

## ✅ 実装済みの修正内容

### 1. manifest.json の最適化
- `purpose`プロパティの調整（iOS互換性のため、`purpose`なしのエントリも追加）
- すべてのアイコンサイズを明示的に指定

### 2. layout.tsx のメタタグ設定
- `apple-mobile-web-app-capable: yes` - PWAとして認識させる
- `apple-mobile-web-app-status-bar-style: default` - ステータスバーのスタイル
- `apple-mobile-web-app-title: 文実シフト管理` - ホーム画面のタイトル
- `apple-touch-icon` の明示的な指定
- `formatDetection: { telephone: false }` - 電話番号の自動リンクを無効化

### 3. アイコンファイル
- `apple-touch-icon.png` (180x180) - **白背景で生成**（透過なし）
- `icon-180x180.png` (180x180) - **白背景で生成**（透過なし）
- 正方形、角丸なし（iOSが自動で角丸にする）

### 4. viewport 設定
- `userScalable: false` - アプリらしい操作感
- `maximumScale: 1` - ズーム防止

## 🔍 確認手順

### ステップ1: デプロイ後の確認
1. **Safariのキャッシュをクリア**
   - 設定 > Safari > 履歴とWebサイトデータを消去

2. **サイトにアクセス**
   - SafariでアプリのURLにアクセス
   - 数回リロードしてキャッシュを更新

3. **共有メニューを確認**
   - Safariの下部にある共有ボタン（□↑）をタップ
   - 「ホーム画面に追加」が表示されるか確認

### ステップ2: PWAとしてインストール
1. **ホーム画面に追加**
   - 共有ボタン > 「ホーム画面に追加」
   - 名前を確認（「文実シフト管理」）
   - 「追加」をタップ

2. **PWAとして起動**
   - ホーム画面のアイコンをタップ
   - フルスクリーンで起動するか確認
   - ブラウザのUI（アドレスバーなど）が表示されないことを確認

### ステップ3: 通知の設定
1. **通知の許可**
   - PWAとして起動した状態で、通知の許可を求められる
   - 「許可」を選択

2. **テスト通知の確認**
   - 許可後、自動的に「これは文実によるテスト通信です」という通知が表示される

## 🐛 よくある問題と解決方法

### 問題1: 「ホーム画面に追加」が表示されない

**原因:**
- `manifest.json`が正しく読み込まれていない
- `apple-mobile-web-app-capable`メタタグが不足
- HTTPSでない（localhostは除く）

**解決方法:**
1. ブラウザの開発者ツールでNetworkタブを確認
   - `/manifest.json`が200で返ってくるか確認
2. HTMLの`<head>`タグを確認
   - `<meta name="apple-mobile-web-app-capable" content="yes">`が存在するか
3. HTTPS接続を確認
   - 本番環境ではHTTPS必須

### 問題2: ホーム画面に追加できるが、ブラウザUIが残る

**原因:**
- `display: standalone`が正しく設定されていない
- `manifest.json`の`display`プロパティが`browser`になっている

**解決方法:**
- `manifest.json`の`display`が`standalone`になっているか確認

### 問題3: アイコンが表示されない、または黒背景になる

**原因:**
- アイコンファイルが透過PNGになっている
- `apple-touch-icon.png`が存在しない、またはパスが間違っている

**解決方法:**
1. `public/apple-touch-icon.png`が存在するか確認
2. アイコンが白背景（透過なし）で生成されているか確認
   ```bash
   npm run generate-icons
   ```
3. HTMLの`<head>`タグに以下が存在するか確認
   ```html
   <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
   ```

### 問題4: 通知の許可要求が表示されない

**原因:**
- PWAとしてインストールされていない
- iOS 16.4未満
- Service Workerが登録されていない

**解決方法:**
1. PWAとしてホーム画面に追加されているか確認
   - ブラウザで直接開いている場合は動作しない
2. iOSバージョンを確認
   - iOS 16.4以降が必要
3. ブラウザのコンソールでエラーを確認
   - Service Workerの登録エラーがないか確認

### 問題5: 通知は届くが、アプリ内で表示されない

**原因:**
- フォアグラウンド時の通知処理が不足
- Service Workerが正しく動作していない

**解決方法:**
- `lib/firebaseClient.ts`の`subscribeInAppMessages`関数が正しく実装されているか確認

## 📱 iOSバージョン別の動作

### iOS 16.4以降
- ✅ Web Push API サポート
- ✅ Service Worker サポート
- ✅ PWAとして完全に動作

### iOS 16.0 - 16.3
- ✅ PWAとしてインストール可能
- ❌ Web Push API 未サポート
- ❌ 通知機能は動作しない

### iOS 15以前
- ✅ PWAとしてインストール可能
- ❌ Service Worker 制限あり
- ❌ 通知機能は動作しない

## 🔧 デバッグ方法

### 1. Safariの開発者ツール（Macからリモートデバッグ）
1. MacのSafariで「開発」メニューを有効化
2. iPhoneをUSB接続
3. MacのSafari > 開発 > [デバイス名] > [ページ名]
4. コンソールでエラーを確認

### 2. ブラウザのコンソール（PWAとして起動時）
- PWAとして起動した状態でも、Safariの開発者ツールでデバッグ可能

### 3. manifest.jsonの検証
- [Web App Manifest Validator](https://manifest-validator.appspot.com/)で検証

## 📝 チェックリスト

デプロイ前に以下を確認：

- [ ] `manifest.json`が正しく読み込まれる（Networkタブで確認）
- [ ] `apple-mobile-web-app-capable`メタタグが存在
- [ ] `apple-touch-icon.png`が存在し、白背景（透過なし）
- [ ] `display: standalone`が設定されている
- [ ] HTTPS接続（本番環境）
- [ ] アイコンが正しいサイズ（180x180）で生成されている
- [ ] `viewport`が正しく設定されている

## 🚀 次のステップ

問題が解決しない場合：
1. ブラウザのコンソールでエラーメッセージを確認
2. Networkタブで`manifest.json`とアイコンファイルの読み込みを確認
3. Safariの開発者ツールで詳細なエラーを確認
4. 上記のチェックリストをすべて確認

