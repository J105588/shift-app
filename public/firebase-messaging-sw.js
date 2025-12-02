// Firebase Cloud Messaging Service Worker
// このファイルはビルド時に環境変数が注入されます

// Firebase の compat バージョンを使用（Service Worker では ES modules が使えないため）
// Firebase v12 に対応した compat バージョンを使用
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js');

// Firebase 設定
// 注意: この設定はビルド時に環境変数から注入されます
// 本番環境では、このファイルがビルド時に生成される必要があります
const firebaseConfig = {
  apiKey: 'FIREBASE_API_KEY_PLACEHOLDER',
  authDomain: 'FIREBASE_AUTH_DOMAIN_PLACEHOLDER',
  projectId: 'FIREBASE_PROJECT_ID_PLACEHOLDER',
  messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER',
  appId: 'FIREBASE_APP_ID_PLACEHOLDER',
};

// Firebase を初期化
firebase.initializeApp(firebaseConfig);

// Messaging インスタンスを取得
const messaging = firebase.messaging();

// バックグラウンドメッセージのハンドリング
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || '通知';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data || {},
    // iOS向けの設定
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200], // iOSでは無視されるが、Android用
    tag: payload.messageId || 'fcm-notification',
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // 通知の data に URL が含まれている場合はそのページを開く
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // 既に開いているウィンドウがある場合はフォーカス
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // 新しいウィンドウを開く
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

