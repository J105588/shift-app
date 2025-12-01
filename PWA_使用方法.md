# PWA使用方法ガイド

## 📱 PWAとは

Progressive Web App（PWA）は、ウェブアプリをネイティブアプリのようにインストールして使用できる技術です。オフライン対応、プッシュ通知、ホーム画面への追加などの機能を提供します。

## 🚀 開発環境での動作確認

### 1. ビルドと起動

```bash
# プロダクションビルド（PWAは本番モードでのみ有効）
npm run build

# 本番モードで起動
npm start
```

**注意**: 開発モード（`npm run dev`）ではPWAは無効になっています。動作確認には本番モードで起動してください。

### 2. ブラウザでアクセス

`http://localhost:3000` にアクセスします。

## 📲 インストール方法

### **デスクトップ（Chrome/Edge）**

1. ブラウザでアプリにアクセス
2. アドレスバーの右側に表示される **インストールアイコン**（＋やダウンロードアイコン）をクリック
3. 「インストール」をクリック
4. アプリがデスクトップにインストールされ、独立したウィンドウで起動できます

### **モバイル（Android - Chrome）**

1. ブラウザでアプリにアクセス
2. メニュー（3点リーダー）を開く
3. 「ホーム画面に追加」または「アプリをインストール」を選択
4. 確認ダイアログで「追加」をタップ
5. ホーム画面にアプリアイコンが追加されます

### **モバイル（iOS - Safari）**

1. Safariでアプリにアクセス
2. 共有ボタン（四角に上矢印）をタップ
3. 「ホーム画面に追加」を選択
4. 名前を確認して「追加」をタップ
5. ホーム画面にアプリアイコンが追加されます

## ✅ 動作確認ポイント

### インストール可能か確認

1. **マニフェストファイル**: `/manifest.json` が正しく読み込まれているか
2. **Service Worker**: ブラウザの開発者ツール（F12）→ Application → Service Workers で登録されているか
3. **オフライン動作**: ネットワークを切断しても、キャッシュされたページが表示されるか

### 開発者ツールでの確認

1. **F12** で開発者ツールを開く
2. **Application** タブを開く
3. **Manifest** セクションでマニフェストの内容を確認
4. **Service Workers** セクションでService Workerの状態を確認
5. **Storage** → **Cache Storage** でキャッシュされたファイルを確認

## 🔧 トラブルシューティング

### Service Workerが登録されない

- 本番モード（`npm run build && npm start`）で起動しているか確認
- HTTPSまたはlocalhostでアクセスしているか確認（PWAはHTTPS必須）
- ブラウザのキャッシュをクリアして再試行

### インストールボタンが表示されない

- マニフェストファイルが正しく読み込まれているか確認
- Service Workerが登録されているか確認
- ブラウザがPWAをサポートしているか確認（Chrome、Edge、Safari（iOS 11.3+））

### オフラインで動作しない

- Service Workerが正しく登録されているか確認
- 一度オンラインでページを訪問してキャッシュを生成する
- 開発者ツールのNetworkタブで「Offline」を選択してテスト

## 📝 注意事項

1. **開発モードでは無効**: `npm run dev` ではPWA機能は無効です。本番ビルドが必要です。
2. **HTTPS必須**: 本番環境ではHTTPSが必要です（localhostは例外）
3. **Service Workerの更新**: コードを更新した後、Service Workerの更新を待つか、ブラウザのキャッシュをクリアしてください

## 🎯 次のステップ

- オフライン機能のカスタマイズ
- プッシュ通知の実装（必要に応じて）
- アプリアイコンのカスタマイズ（`public/icon.svg`を編集して再生成）

## 📚 参考リンク

- [Next.js PWA Documentation](https://github.com/shadowwalker/next-pwa)
- [MDN Web Docs - Progressive Web Apps](https://developer.mozilla.org/ja/docs/Web/Progressive_web_apps)
- [Web.dev - PWA](https://web.dev/progressive-web-apps/)

