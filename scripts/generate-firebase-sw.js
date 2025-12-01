// Firebase Service Worker ファイルを生成するスクリプト
// ビルド時に環境変数を注入して public/firebase-messaging-sw.js を生成します

const fs = require('fs');
const path = require('path');

// .env.local を読み込む（開発環境用）
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
} catch (e) {
  // dotenv が利用できない、または .env.local が存在しない場合は無視
}

function generateFirebaseSW() {
  const templatePath = path.join(__dirname, '../public/firebase-messaging-sw.js');
  const outputPath = path.join(__dirname, '../public/firebase-messaging-sw.js');

  // 環境変数を取得
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  };

  // テンプレートファイルを読み込む
  let content = fs.readFileSync(templatePath, 'utf8');

  // プレースホルダーを環境変数で置き換え
  content = content.replace(/FIREBASE_API_KEY_PLACEHOLDER/g, firebaseConfig.apiKey);
  content = content.replace(/FIREBASE_AUTH_DOMAIN_PLACEHOLDER/g, firebaseConfig.authDomain);
  content = content.replace(/FIREBASE_PROJECT_ID_PLACEHOLDER/g, firebaseConfig.projectId);
  content = content.replace(/FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER/g, firebaseConfig.messagingSenderId);
  content = content.replace(/FIREBASE_APP_ID_PLACEHOLDER/g, firebaseConfig.appId);

  // ファイルを書き込む
  fs.writeFileSync(outputPath, content, 'utf8');

  // 環境変数が設定されているかチェック
  const missingVars = [];
  if (!firebaseConfig.apiKey) missingVars.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missingVars.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missingVars.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.messagingSenderId) missingVars.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  if (!firebaseConfig.appId) missingVars.push('NEXT_PUBLIC_FIREBASE_APP_ID');

  if (missingVars.length > 0) {
    console.warn('⚠️  警告: 以下の Firebase 環境変数が設定されていません:');
    missingVars.forEach(v => console.warn(`   - ${v}`));
    console.warn('   Push 通知機能は動作しません。');
  } else {
    console.log('✓ firebase-messaging-sw.js を生成しました');
  }
}

generateFirebaseSW();

