# vConsole 使用方法

vConsoleは、モバイルデバイス（特にiOS）でブラウザの開発者ツールのような機能を提供するライブラリです。

## 📱 機能

- **コンソールログ**: `console.log()`, `console.error()` などを表示
- **ネットワーク**: HTTPリクエストの監視
- **要素**: DOM要素の検証
- **ストレージ**: LocalStorage、SessionStorage、Cookieの確認
- **システム**: デバイス情報、ユーザーエージェントなどの確認

## 🚀 有効化方法

### 方法1: 開発環境で自動有効化（デフォルト）

開発環境（`npm run dev`）では自動的に有効化されます。

```bash
npm run dev
```

### 方法2: 環境変数で有効化

本番環境でも有効化したい場合は、`.env.local` に以下を追加：

```env
NEXT_PUBLIC_ENABLE_VCONSOLE=true
```

または、Vercelなどの環境変数設定で追加：

```
NEXT_PUBLIC_ENABLE_VCONSOLE=true
```

## 🎯 使用方法

1. **アプリを開く**
   - iOSデバイスでアプリを開く（PWAとしても可）

2. **vConsoleを表示**
   - 画面右下に緑色の「vConsole」ボタンが表示されます
   - タップしてコンソールを開く

3. **タブを切り替え**
   - **Log**: コンソールログ
   - **System**: システム情報
   - **Network**: ネットワークリクエスト
   - **Element**: DOM要素
   - **Storage**: ストレージ情報

4. **ログを確認**
   - `console.log()`, `console.error()` などの出力が表示されます
   - エラーメッセージやデバッグ情報を確認できます

## 🔧 カスタマイズ

`components/VConsole.tsx` を編集して、以下の設定を変更できます：

- **テーマ**: `theme: 'dark'` または `'light'`
- **プラグイン**: `defaultPlugins` で有効化するプラグインを指定
- **最大ログ数**: `maxLogNumber` でログの最大数を指定

## 🚫 無効化方法

### 開発環境で無効化

`components/VConsole.tsx` の以下の部分をコメントアウト：

```typescript
const isDevelopment = process.env.NODE_ENV === 'development'
// const isEnabled = process.env.NEXT_PUBLIC_ENABLE_VCONSOLE === 'true'

if (!isDevelopment && !isEnabled) {
  return
}
```

または、環境変数を削除：

```env
# NEXT_PUBLIC_ENABLE_VCONSOLE=true を削除または false に設定
```

### 完全に削除

1. `components/VConsole.tsx` を削除
2. `components/ClientProviders.tsx` から `<VConsole />` を削除
3. `npm uninstall vconsole` でパッケージを削除

## 📝 注意事項

- vConsoleは開発・デバッグ用のツールです
- 本番環境では通常、無効化することを推奨します
- パフォーマンスへの影響は軽微ですが、大量のログがある場合は注意が必要です
- iOSのPWAとして起動した場合でも動作します

## 🐛 トラブルシューティング

### vConsoleが表示されない

1. **環境変数を確認**
   - 開発環境では自動的に有効化されます
   - 本番環境では `NEXT_PUBLIC_ENABLE_VCONSOLE=true` が必要です

2. **ブラウザのコンソールでエラーを確認**
   - vConsoleの読み込みエラーがないか確認

3. **キャッシュをクリア**
   - ブラウザのキャッシュをクリアして再読み込み

### ログが表示されない

- `console.log()` などの呼び出しが正しいか確認
- vConsoleの「Log」タブが選択されているか確認
- ログの最大数（`maxLogNumber`）を確認

## 📚 参考資料

- [vConsole GitHub](https://github.com/Tencent/vConsole)
- [vConsole ドキュメント](https://github.com/Tencent/vConsole/blob/dev/README.md)

