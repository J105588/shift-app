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
 * 
 * 【Webhook設定】
 * - このスクリプトをWebアプリとして公開し、doPost関数を実行可能に設定
 * - 公開URLを取得して、クライアント側から呼び出し可能にする
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
    // 1. 送信前に sent_at を更新して重複処理を防ぐ（ロックとして機能）
    // これにより、同じ通知が複数のGAS実行で処理されるのを防ぐ
    var lockResult = markNotificationSent(supabaseUrl, supabaseKey, notif.id);
    
    // sent_at の更新に失敗した場合（既に他のプロセスで処理中など）はスキップ
    if (!lockResult) {
      console.log('スキップ: 既に処理中または処理済み (notification_id: ' + notif.id + ')');
      return;
    }

    // 2. 対象ユーザーの push_subscriptions から FCM トークンを取得
    const tokens = fetchUserTokens(supabaseUrl, supabaseKey, notif.target_user_id);

    if (!tokens || tokens.length === 0) {
      console.log('スキップ: トークンなし (notification_id: ' + notif.id + ', user_id: ' + notif.target_user_id + ')');
      // トークンがない場合は既に sent_at を更新済みなので、そのまま終了
      return;
    }

    // 3. 各デバイス(トークン)に送信（万一同じトークンが重複していても一度だけ送る）
    // 通知IDを含めた一意の messageId を生成するため、通知IDを渡す
    var unique = {};
    tokens.forEach(function (t) {
      if (t && t.token) {
        unique[t.token] = true;
      }
    });

    // 通知IDを含めた一意の messageId を生成するため、通知IDを渡す
    Object.keys(unique).forEach(function (token) {
      sendFcmNotificationV1WithToken(
        projectId,
        accessToken,
        token,
        notif.title,
        notif.body,
        notif.id, // 通知IDを渡す（重複防止のため）
        supabaseUrl,
        supabaseKey,
        notif.shift_group_id // チャットページへのリンク用
      );
    });

    // 4. sent_at は既に更新済み（送信前にロックとして更新）

  } catch (e) {
    console.error('個別通知エラー (id=' + notif.id + '): ' + e.toString());
    // 個別のエラーは握りつぶし、他の通知の処理を止めないようにする
    // エラーが発生しても sent_at は既に更新されているため、無限ループは防げる
  }
}

/**
 * Supabase から「期限が来た未送信通知」を取得
 * limitパラメータを追加して大量データを分割処理
 */
function fetchDueNotifications(supabaseUrl, supabaseKey, nowIso, limit) {
  // API URL構築
  var url = supabaseUrl + '/rest/v1/notifications'
    + '?select=id,target_user_id,title,body,scheduled_at,shift_group_id'
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
function sendFcmNotificationV1WithToken(projectId, accessToken, token, title, body, notificationId, supabaseUrl, supabaseKey, shiftGroupId) {
  var url = 'https://fcm.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/messages:send';

  // 通知の重複を防ぐため、通知IDベースで一意の messageId を生成
  // 同じ通知IDの通知は同じ messageId になるため、クライアント側で重複チェックが可能
  // 通知IDが渡されていない場合は、タイトルと本文のハッシュを使用（後方互換性のため）
  var messageId;
  if (notificationId) {
    // 通知IDを使用（最も確実な方法）- UUIDのハイフンを削除して使用
    messageId = 'msg-' + notificationId.replace(/-/g, '').substring(0, 16);
  } else {
    // 通知IDがない場合は、タイトルと本文のハッシュを使用
    var contentHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      title + '|' + body,
      Utilities.Charset.UTF_8
    );
    var hashString = Utilities.base64EncodeWebSafe(contentHash).replace(/=+$/, '');
    messageId = 'msg-' + hashString.substring(0, 16) + '-' + Math.floor(Date.now() / 1000);
  }
  
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
           link: shiftGroupId ? "/chat/" + shiftGroupId : "/" // チャット通知の場合はチャットページへ
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
 * 通知を「送信済み」にマークする（アトミックな更新）
 * 戻り値: 更新が成功した場合 true、既に更新済みまたは失敗した場合 false
 * 
 * この関数は、PostgreSQLのSELECT ... FOR UPDATE SKIP LOCKEDを使用して
 * アトミックな更新を保証し、重複処理を防ぐ
 */
function markNotificationSent(supabaseUrl, supabaseKey, notifId) {
  // RPC関数を使用してアトミックな更新を実行
  var url = supabaseUrl + '/rest/v1/rpc/mark_notification_sent_atomic';
  
  var options = {
    method: 'post',
    headers: {
      apikey: supabaseKey,
      Authorization: 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({ p_notification_id: notifId }),
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(url, options);
  var status = res.getResponseCode();
  
  if (status >= 300) {
    console.error('markNotificationSent error: ' + res.getContentText());
    return false;
  }
  
  // RPC関数はbooleanを返す
  try {
    var result = JSON.parse(res.getContentText());
    // RPC関数の戻り値はboolean（true/false）
    if (result === true) {
      return true;
    } else {
      console.log('更新失敗: 既に他のプロセスで更新済み (notification_id: ' + notifId + ')');
      return false;
    }
  } catch (e) {
    // JSONパースエラーは無視（更新は成功した可能性がある）
    console.warn('markNotificationSent JSON parse error: ' + e.toString());
    // レスポンスが空の場合は失敗とみなす
    return false;
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

/**
 * Webアプリ用GETエンドポイント
 * Webアプリとして公開する際に必要
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Shift App Notification Service',
    version: '1.0.0',
    endpoints: {
      post: 'POSTリクエストで通知を即座に送信できます'
    }
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Webhookエンドポイント: 通知を即座に送信
 * POSTリクエストで通知IDの配列を受け取り、即座に送信する
 * 
 * リクエストボディ例:
 * {
 *   "notification_ids": ["uuid1", "uuid2", ...]
 * }
 * 
 * レスポンス:
 * {
 *   "success": true,
 *   "processed": 2,
 *   "errors": []
 * }
 */
function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var SUPABASE_URL = props.getProperty('SUPABASE_URL');
    var SUPABASE_KEY = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
    var FCM_PROJECT_ID = props.getProperty('FCM_PROJECT_ID');
    var FCM_SA_CLIENT_EMAIL = props.getProperty('FCM_SA_CLIENT_EMAIL');
    var FCM_SA_PRIVATE_KEY = props.getProperty('FCM_SA_PRIVATE_KEY');

    if (!SUPABASE_URL || !SUPABASE_KEY || !FCM_PROJECT_ID || !FCM_SA_CLIENT_EMAIL || !FCM_SA_PRIVATE_KEY) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: '設定エラー: スクリプトプロパティに必要な値が設定されていません。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // リクエストボディをパース
    var requestData;
    try {
      requestData = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'リクエストボディのパースに失敗しました: ' + parseError.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var notificationIds = requestData.notification_ids;
    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'notification_ids が配列として提供されていません。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // FCMアクセストークンを取得
    var accessToken = getFcmAccessToken_(FCM_PROJECT_ID, FCM_SA_CLIENT_EMAIL, FCM_SA_PRIVATE_KEY);

    // 各通知IDに対応する通知を取得して送信
    var processed = 0;
    var errors = [];

    notificationIds.forEach(function(notifId) {
      try {
        // 通知情報を取得
        var url = SUPABASE_URL + '/rest/v1/notifications'
          + '?id=eq.' + encodeURIComponent(notifId)
          + '&select=id,target_user_id,title,body,scheduled_at,sent_at,shift_group_id';

        var options = {
          method: 'get',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
          },
          muteHttpExceptions: true,
        };

        var res = UrlFetchApp.fetch(url, options);
        if (res.getResponseCode() >= 300) {
          errors.push({ id: notifId, error: '通知取得エラー: ' + res.getContentText() });
          return;
        }

        var notifications = JSON.parse(res.getContentText());
        if (!notifications || notifications.length === 0) {
          errors.push({ id: notifId, error: '通知が見つかりません' });
          return;
        }

        var notif = notifications[0];

        // 既に送信済みの場合はスキップ
        if (notif.sent_at) {
          return;
        }

        // 通知を送信（shift_group_idも含まれる）
        processSingleNotification(notif, SUPABASE_URL, SUPABASE_KEY, FCM_PROJECT_ID, accessToken);
        processed++;
      } catch (err) {
        errors.push({ id: notifId, error: err.toString() });
      }
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      processed: processed,
      errors: errors
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '全体処理エラー: ' + e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}