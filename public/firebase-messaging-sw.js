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
// 注意: このハンドラーはアプリが完全に閉じている（バックグラウンド）時のみ発火する
// フォアグラウンド時は onMessage が発火するため、重複通知を避ける
messaging.onBackgroundMessage((payload) => {
  // タイトルが空の場合は通知を表示しない
  const notificationTitle = payload.notification?.title;
  if (!notificationTitle || !notificationTitle.trim()) {
    return Promise.resolve();
  }
  
  // GAS 側で生成した messageId を data から取得（重複防止用）
  const tag = payload.data?.messageId || 
              payload.messageId || 
              `fcm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // 既に同じ tag の通知が表示されている場合は閉じる（重複防止）
  self.registration.getNotifications({ tag: tag }).then((notifications) => {
    notifications.forEach((n) => n.close());
  }).catch(() => {
    // getNotifications が使えない環境では無視
  });

  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data || {},
    // iOS向けの設定
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200], // iOSでは無視されるが、Android用
    tag: tag, // 同じメッセージIDの通知は1つだけ表示されるようにする
    // バックグラウンドでも確実に通知を表示するための設定
    renotify: false, // 重複通知を防ぐため false に変更
    // 通知の優先度を高く設定（Android用）
    priority: 'high',
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Service Workerのインストール時に、確実にアクティブ化する
self.addEventListener('install', (event) => {
  // すぐにアクティブ化して、古いService Workerを置き換える
  self.skipWaiting();
});

// Service Workerのアクティベート時に、すべてのクライアントを制御下に置く
self.addEventListener('activate', (event) => {
  event.waitUntil(
    clients.claim().then(() => {
      // すべてのクライアントを制御下に置く
      return self.clients.matchAll();
    })
  );
});

// Pushイベントのハンドリング（FCM以外のPush通知にも対応）
// 注意: FCMのメッセージは onBackgroundMessage で処理されるため、
// push イベントでは FCM メッセージを確実にスキップする必要がある
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }
  
  try {
    const payload = event.data.json();
    
    // FCMのメッセージを確実にスキップ
    // FCMメッセージには以下の特徴がある：
    // 1. notification オブジェクトが存在する
    // 2. data オブジェクトに messageId が含まれる
    // 3. from が 'firebase' または firebase プロパティが存在する
    if (
      payload.notification ||
      payload.data?.messageId ||
      payload.from === 'firebase' ||
      payload.firebase ||
      payload.fcmMessageId
    ) {
      // FCMメッセージは onBackgroundMessage で処理されるため、ここでは何もしない
      return;
    }
    
    // FCM以外のPush通知のみ処理
    const title = payload.title || '通知';
    const options = {
      body: payload.body || '',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: payload.data || {},
      tag: payload.tag || `push-${Date.now()}`,
      renotify: true,
      priority: 'high',
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (e) {
    // JSONパースエラーは無視（FCMメッセージの可能性があるため）
  }
});

// Service Workerがメッセージを受信したときの処理
// クライアント側からService Workerにメッセージを送信できるようにする
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // クライアントにメッセージを返す
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({ success: true });
  }
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

