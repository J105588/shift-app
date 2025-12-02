/**
 * ====================================================================
 * Firebase Cloud Messaging (FCM) 通知送信スクリプト (HTTP v1 API)
 * ====================================================================
 * 
 * 【概要】
 * Supabase から配信時刻(scheduled_at)を過ぎた未送信通知を取得し、
 * FCM を経由してユーザーにプッシュ通知を送信します。
 * 送信後は sent_at を更新して二重送信を防ぎます。
 * 
 * 【設定: スクリプトプロパティ】
 * 以下の値を「プロジェクトの設定 > スクリプトプロパティ」に設定してください。
 * 
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - FCM_PROJECT_ID          : Firebase プロジェクト ID
 * - FCM_SA_CLIENT_EMAIL     : サービスアカウントの client_email
 * - FCM_SA_PRIVATE_KEY      : サービスアカウントの private_key
 *                             (-----BEGIN... から ...END----- まで全て)
 * 
 * 【トリガー設定】
 * - 関数: processNotifications
 * - イベントのソース: 時間主導型
 * - タイプ: 分ベースのタイマー (1分おき)
 */

// 1回の実行で処理する通知の最大件数 (タイムアウト対策)
// 処理が重い場合はこの数字を小さくしてください (例: 20〜50推奨)
const BATCH_SIZE = 50;

function processNotifications() {
  const props = PropertiesService.getScriptProperties();
  const SUPABASE_URL = props.getProperty('SUPABASE_URL');
  const SUPABASE_KEY = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  const FCM_PROJECT_ID = props.getProperty('FCM_PROJECT_ID');
  const FCM_SA_CLIENT_EMAIL = props.getProperty('FCM_SA_CLIENT_EMAIL');
  const FCM_SA_PRIVATE_KEY = props.getProperty('FCM_SA_PRIVATE_KEY');

  if (!SUPABASE_URL || !SUPABASE_KEY || !FCM_PROJECT_ID || !FCM_SA_CLIENT_EMAIL || !FCM_SA_PRIVATE_KEY) {
    throw new Error('設定エラー: スクリプトプロパティに必要な値が設定されていません。');
  }

  // 現在時刻 (ISO 8601)
  const nowIso = new Date().toISOString();

  try {
    // 1. 送信対象の notifications を取得（件数制限付き）
    const notifications = fetchDueNotifications(SUPABASE_URL, SUPABASE_KEY, nowIso, BATCH_SIZE);

    if (!notifications || notifications.length === 0) {
      // 送信対象なし。正常終了。
      return;
    }

    console.log('送信対象件数: ' + notifications.length + '件');

    // FCMアクセストークンは1回の実行につき1回取得して使い回す（効率化）
    const accessToken = getFcmAccessToken_(FCM_PROJECT_ID, FCM_SA_CLIENT_EMAIL, FCM_SA_PRIVATE_KEY);

    // 各通知を処理
    notifications.forEach(function (notif) {
      processSingleNotification(notif, SUPABASE_URL, SUPABASE_KEY, FCM_PROJECT_ID, accessToken);
    });

  } catch (e) {
    console.error('全体処理エラー: ' + e.toString());
    // ここでエラーになっても、次のトリガーで再試行されます
  }
}

/**
 * 1件の通知処理をカプセル化
 */
function processSingleNotification(notif, supabaseUrl, supabaseKey, projectId, accessToken) {
  try {
    // 2. 対象ユーザーの push_subscriptions から FCM トークンを取得
    const tokens = fetchUserTokens(supabaseUrl, supabaseKey, notif.target_user_id);

    if (!tokens || tokens.length === 0) {
      console.log('スキップ: トークンなし (notification_id: ' + notif.id + ', user_id: ' + notif.target_user_id + ')');
      // トークンがない場合も「送信済み」扱いにして、無限ループを防ぐ
      markNotificationSent(supabaseUrl, supabaseKey, notif.id);
      return;
    }

    // 3. 各デバイス(トークン)に送信（万一同じトークンが重複していても一度だけ送る）
    var unique = {};
    tokens.forEach(function (t) {
      if (t && t.token) {
        unique[t.token] = true;
      }
    });

    Object.keys(unique).forEach(function (token) {
      sendFcmNotificationV1WithToken(
        projectId,
        accessToken,
        token,
        notif.title,
        notif.body,
        supabaseUrl,
        supabaseKey
      );
    });

    // 4. 成功したら sent_at を更新
    markNotificationSent(supabaseUrl, supabaseKey, notif.id);

  } catch (e) {
    console.error('個別通知エラー (id=' + notif.id + '): ' + e.toString());
    // 個別のエラーは握りつぶし、他の通知の処理を止めないようにする
  }
}

/**
 * Supabase から「期限が来た未送信通知」を取得
 * limitパラメータを追加して大量データを分割処理
 */
function fetchDueNotifications(supabaseUrl, supabaseKey, nowIso, limit) {
  // API URL構築
  var url = supabaseUrl + '/rest/v1/notifications'
    + '?select=id,target_user_id,title,body,scheduled_at'
    + '&scheduled_at=lte.' + encodeURIComponent(nowIso)
    + '&sent_at=is.null'
    + '&limit=' + limit  // 件数制限
    + '&order=scheduled_at.asc'; // 古いものから順に処理

  var options = {
    method: 'get',
    headers: {
      apikey: supabaseKey,
      Authorization: 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() >= 300) {
    throw new Error('fetchDueNotifications error: ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

/**
 * Supabase からユーザーの FCM トークン一覧を取得
 * 同じ user_id で複数のトークンがある場合、最新のものを残して古いものを削除する
 */
function fetchUserTokens(supabaseUrl, supabaseKey, userId) {
  var url = supabaseUrl + '/rest/v1/push_subscriptions'
    + '?select=id,token,created_at'
    + '&user_id=eq.' + encodeURIComponent(userId)
    + '&order=created_at.desc'; // 新しい順に取得

  var options = {
    method: 'get',
    headers: {
      apikey: supabaseKey,
      Authorization: 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() >= 300) {
    throw new Error('fetchUserTokens error: ' + res.getContentText());
  }
  
  var tokens = JSON.parse(res.getContentText());
  
  // トークンが1つ以下の場合はそのまま返す
  if (!tokens || tokens.length <= 1) {
    return tokens || [];
  }
  
  // 複数のトークンがある場合、最新の1つだけを残して古いものを削除
  var latestToken = tokens[0]; // created_at.desc で取得しているので、最初が最新
  var tokensToDelete = tokens.slice(1); // 2番目以降が古いトークン
  
  // 古いトークンを削除
  tokensToDelete.forEach(function(oldToken) {
    try {
      deletePushSubscriptionById_(supabaseUrl, supabaseKey, oldToken.id);
    } catch (e) {
      // 削除エラーはログに記録するが、処理は続行
      console.warn('古いトークン削除エラー (id=' + oldToken.id + '): ' + e.toString());
    }
  });
  
  // 最新のトークン1つだけを返す
  return [latestToken];
}

/**
 * Supabase の push_subscriptions から指定IDのレコードを削除
 */
function deletePushSubscriptionById_(supabaseUrl, supabaseKey, subscriptionId) {
  var url = supabaseUrl + '/rest/v1/push_subscriptions'
    + '?id=eq.' + encodeURIComponent(subscriptionId);

  var options = {
    method: 'delete',
    headers: {
      apikey: supabaseKey,
      Authorization: 'Bearer ' + supabaseKey,
      Prefer: 'return=minimal',
    },
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() >= 300) {
    throw new Error('deletePushSubscriptionById error: ' + res.getContentText());
  }
}

/**
 * FCM HTTP v1 用のアクセストークンをサービスアカウントで取得
 */
function getFcmAccessToken_(projectId, clientEmail, privateKey) {
  // 改行コードの復元
  var pk = privateKey.replace(/\\n/g, '\n');

  var now = Math.floor(new Date().getTime() / 1000);
  var jwtHeader = { alg: 'RS256', typ: 'JWT' };
  var jwtClaimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  var unsignedJwt = base64UrlEncode_(jwtHeader) + '.' + base64UrlEncode_(jwtClaimSet);
  var signatureBytes = Utilities.computeRsaSha256Signature(unsignedJwt, pk);
  var signature = Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');
  var signedJwt = unsignedJwt + '.' + signature;

  var payload = {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: signedJwt,
  };

  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() >= 300) {
    throw new Error('Failed to get FCM access token: ' + res.getContentText());
  }

  var data = JSON.parse(res.getContentText());
  return data.access_token;
}

/**
 * Base64 URL Encode Helper
 */
function base64UrlEncode_(obj) {
  return Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
}

/**
 * FCM HTTP v1 でプッシュ通知を送信 (アクセストークン再利用版)
 * 404 / 410 (UNREGISTERED) などの応答が返ったトークンは Supabase 側から自動削除する
 */
function sendFcmNotificationV1WithToken(projectId, accessToken, token, title, body, supabaseUrl, supabaseKey) {
  var url = 'https://fcm.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/messages:send';

  // 通知の重複を防ぐため、一意の messageId を生成
  // この messageId はクライアント側で重複チェックに使用される
  var messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  
  var payload = {
    message: {
      token: token,
      notification: {
        title: title,
        body: body,
      },
      // Webアプリの場合、クリック時のリンクなどを設定可能
      webpush: {
        fcm_options: {
           link: "/" // 必要に応じて通知クリック時のURLを指定
        },
        // 通知の重複を防ぐため、一意の tag を設定
        headers: {
          'Tag': messageId
        }
      },
      // data に messageId を含める（クライアント側の onMessage で使用）
      data: {
        messageId: messageId
      }
    },
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + accessToken,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(url, options);
  var status = res.getResponseCode();
  var bodyText = res.getContentText();

  if (status >= 300) {
    // 無効トークン系のエラーは Supabase から削除して、次回以降処理しないようにする
    if (
      status === 404 ||
      status === 410 ||
      bodyText.indexOf('UNREGISTERED') !== -1
    ) {
      try {
        deletePushSubscriptionByToken_(supabaseUrl, supabaseKey, token);
      } catch (e) {
        console.warn('無効トークン削除時エラー (' + token + '): ' + e.toString());
      }
    } else {
      console.warn('FCM送信失敗 (' + token + '): ' + bodyText);
    }
  }
}

/**
 * 通知を「送信済み」にマークする
 */
function markNotificationSent(supabaseUrl, supabaseKey, notifId) {
  var url = supabaseUrl + '/rest/v1/notifications'
    + '?id=eq.' + encodeURIComponent(notifId);

  var body = {
    sent_at: new Date().toISOString(),
  };

  var options = {
    method: 'patch',
    headers: {
      apikey: supabaseKey,
      Authorization: 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() >= 300) {
    console.error('markNotificationSent error: ' + res.getContentText());
  }
}

/**
 * Supabase の push_subscriptions から指定トークンのレコードを削除
 * 無効になった FCM トークンを自動的にクリーンアップするために使用
 */
function deletePushSubscriptionByToken_(supabaseUrl, supabaseKey, token) {
  var url = supabaseUrl + '/rest/v1/push_subscriptions'
    + '?token=eq.' + encodeURIComponent(token);

  var options = {
    method: 'delete',
    headers: {
      apikey: supabaseKey,
      Authorization: 'Bearer ' + supabaseKey,
      Prefer: 'return=minimal',
    },
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() >= 300) {
    throw new Error('deletePushSubscriptionByToken error: ' + res.getContentText());
  }
}