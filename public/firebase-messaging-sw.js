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
  apiKey: 'AIzaSyDZzjTjur9RciSWMRIM6q6nVlMIn7AhYoM',
  authDomain: 'nazuna-fes-shifts.firebaseapp.com',
  projectId: 'nazuna-fes-shifts',
  messagingSenderId: '330724605648',
  appId: '1:330724605648:web:f144f1c51ed295699fe8d5',
};

// Firebase を初期化
firebase.initializeApp(firebaseConfig);

// Messaging インスタンスを取得
const messaging = firebase.messaging();

// 処理済みメッセージを記録（重複防止用）
// メモリリークを防ぐため、最大100件まで保持
const processedMessages = new Set();
const MAX_PROCESSED_MESSAGES = 100;

// 処理済みメッセージのクリーンアップ
function cleanupProcessedMessages() {
  if (processedMessages.size > MAX_PROCESSED_MESSAGES) {
    const oldestMessages = Array.from(processedMessages).slice(0, processedMessages.size - MAX_PROCESSED_MESSAGES);
    oldestMessages.forEach(msg => processedMessages.delete(msg));
  }
}

// バックグラウンドメッセージのハンドリング
// 注意: このハンドラーはアプリが完全に閉じている（バックグラウンド）時のみ発火する
// フォアグラウンド時は onMessage が発火するため、重複通知を避ける
messaging.onBackgroundMessage((payload) => {
  // 通知タイトル・本文を data メッセージからも取得する（notification payload なしでも動作させる）
  const notificationTitle = payload.notification?.title || payload.data?.title;
  const notificationBody = payload.notification?.body || payload.data?.body || '';
  if (!notificationTitle || !notificationTitle.trim()) {
    return Promise.resolve();
  }
  
  // GAS 側で生成した messageId を data から取得（重複防止用）
  const messageId = payload.data?.messageId || payload.messageId;
  const tag = messageId || `fcm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // 既に処理済みのメッセージの場合はスキップ（同期的にチェック）
  if (messageId && processedMessages.has(messageId)) {
    console.log('重複通知をスキップ（処理済み） (messageId: ' + messageId + ', tag: ' + tag + ')');
    return Promise.resolve();
  }
  
  // 処理済みとして記録（同期的に実行）
  if (messageId) {
    processedMessages.add(messageId);
    cleanupProcessedMessages();
  }
  
  // 既に同じ tag の通知が表示されている場合は閉じる（重複防止）
  return self.registration.getNotifications({ tag: tag }).then((notifications) => {
    // 既に同じ tag の通知が存在する場合は、新しい通知を表示しない
    if (notifications && notifications.length > 0) {
      console.log('重複通知をスキップ（既存通知あり） (tag: ' + tag + ', title: ' + notificationTitle + ')');
      // 既存の通知を閉じる
      notifications.forEach((n) => n.close());
      return Promise.resolve();
    }
    
    const notificationOptions = {
      body: notificationBody,
      icon: payload.notification?.icon || payload.data?.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: payload.data || {},
      // iOS向けの設定
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200], // iOSでは無視されるが、Android用
      tag: tag, // 同じメッセージIDの通知は1つだけ表示されるようにする（ブラウザが自動的に置き換える）
      // バックグラウンドでも確実に通知を表示するための設定
      renotify: false, // 重複通知を防ぐため false に変更
      // 通知の優先度を高く設定（Android用）
      priority: 'high',
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  }).catch((error) => {
    // getNotifications が使えない環境では、通常通り通知を表示
    console.warn('getNotifications error: ' + error.toString());
    const notificationOptions = {
      body: notificationBody,
      icon: payload.notification?.icon || payload.data?.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: payload.data || {},
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
      tag: tag,
      renotify: false, // 重複通知を防ぐ
      priority: 'high',
    };
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
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
    // 4. FCMのメッセージIDが存在する
    const messageId = payload.data?.messageId || payload.messageId || payload.fcmMessageId;
    const isFcmMessage = !!(
      payload.notification ||
      messageId ||
      payload.from === 'firebase' ||
      payload.firebase ||
      payload['gcm.message_id'] ||
      payload['google.c.a.e']
    );
    
    if (isFcmMessage) {
      // FCMメッセージは onBackgroundMessage で処理されるため、ここでは何もしない
      // 既に処理済みのメッセージの場合は確実にスキップ
      if (messageId && processedMessages.has(messageId)) {
        console.log('pushイベント: 重複FCMメッセージをスキップ (messageId: ' + messageId + ')');
        return;
      }
      // 注意: 処理済みとして記録しない（onBackgroundMessageで処理されるため）
      // pushイベントで記録すると、onBackgroundMessageが発火する前に記録されてしまう可能性がある
      return;
    }
    
    // FCM以外のPush通知のみ処理
    const title = payload.title || payload.data?.title || '通知';
    const tag = payload.tag || `push-${Date.now()}`;
    
    // 既に同じ tag の通知が表示されている場合はスキップ
    event.waitUntil(
      self.registration.getNotifications({ tag: tag }).then((notifications) => {
        if (notifications && notifications.length > 0) {
          console.log('pushイベント: 重複通知をスキップ (tag: ' + tag + ')');
          return Promise.resolve();
        }
        
        const options = {
          body: payload.body || payload.data?.body || '',
          icon: payload.data?.icon || '/icon-192x192.png',
          badge: '/icon-192x192.png',
          data: payload.data || {},
          tag: tag,
          renotify: false, // 重複通知を防ぐ
          priority: 'high',
        };
        
        return self.registration.showNotification(title, options);
      }).catch(() => {
        // エラー時は通知を表示しない
        console.warn('pushイベント: getNotifications error');
      })
    );
  } catch (e) {
    // JSONパースエラーは無視（FCMメッセージの可能性があるため）
    console.warn('pushイベント: JSON parse error');
  }
});

// Service Workerがメッセージを受信したときの処理
// クライアント側からService Workerにメッセージを送信できるようにする
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // クライアント側から処理済みメッセージの確認リクエスト
  if (event.data && event.data.type === 'CHECK_PROCESSED_MESSAGE') {
    const messageId = event.data.messageId;
    const isProcessed = messageId && processedMessages.has(messageId);
    
    // クライアントに結果を返す
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ 
        success: true, 
        isProcessed: isProcessed,
        messageId: messageId 
      });
    }
    return;
  }
  
  // クライアント側からメッセージを処理済みとして記録するリクエスト
  if (event.data && event.data.type === 'MARK_PROCESSED') {
    const messageId = event.data.messageId;
    if (messageId) {
      processedMessages.add(messageId);
      cleanupProcessedMessages();
    }
    
    // クライアントに結果を返す
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ 
        success: true, 
        messageId: messageId 
      });
    }
    return;
  }
  
  // クライアントにメッセージを返す
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({ success: true });
  }
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // 通知の data から URL を取得
  // shift_group_id がある場合はチャットページへ、なければ data.url または '/'
  const shiftGroupId = event.notification.data?.shiftGroupId;
  const urlToOpen = shiftGroupId 
    ? '/chat/' + shiftGroupId 
    : (event.notification.data?.url || '/');
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // 既に開いているウィンドウがある場合はフォーカス
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // URLが一致するか、チャットページの場合はシフトグループIDで判定
        if (shiftGroupId && client.url.includes('/chat/' + shiftGroupId)) {
          return client.focus();
        } else if (client.url === urlToOpen && 'focus' in client) {
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

