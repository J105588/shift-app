/**
 * メイン:
 *  - 期限の来た通知を Supabase から取得
 *  - Firebase Cloud Messaging HTTP v1 API で配信
 *  - sent_at を更新して二重送信を防止
 *
 * 必要な Script Properties:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - FCM_PROJECT_ID              : Firebase プロジェクト ID
 *  - FCM_SA_CLIENT_EMAIL         : サービスアカウントの client_email
 *  - FCM_SA_PRIVATE_KEY          : サービスアカウントの private_key（改行は \n で保存してOK）
 */
function processNotifications() {
  const props = PropertiesService.getScriptProperties();
  const SUPABASE_URL = props.getProperty('SUPABASE_URL');
  const SUPABASE_KEY = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  const FCM_PROJECT_ID = props.getProperty('FCM_PROJECT_ID');
  const FCM_SA_CLIENT_EMAIL = props.getProperty('FCM_SA_CLIENT_EMAIL');
  const FCM_SA_PRIVATE_KEY = props.getProperty('FCM_SA_PRIVATE_KEY');

  if (!SUPABASE_URL || !SUPABASE_KEY || !FCM_PROJECT_ID || !FCM_SA_CLIENT_EMAIL || !FCM_SA_PRIVATE_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / FCM_PROJECT_ID / FCM_SA_CLIENT_EMAIL / FCM_SA_PRIVATE_KEY が設定されていません。');
  }

  const nowIso = new Date().toISOString();

  // 1. 送信対象の notifications を取得（scheduled_at <= now かつ sent_at IS NULL）
  const notifications = fetchDueNotifications(SUPABASE_URL, SUPABASE_KEY, nowIso);

  if (!notifications || notifications.length === 0) {
    console.log('送信対象の通知はありません');
    return;
  }

  notifications.forEach(function (notif) {
    try {
      // 2. 対象ユーザーの push_subscriptions から FCM トークンを取得
      const tokens = fetchUserTokens(SUPABASE_URL, SUPABASE_KEY, notif.target_user_id);
      if (!tokens || tokens.length === 0) {
        console.log('トークンなし user_id=' + notif.target_user_id);
        markNotificationSent(SUPABASE_URL, SUPABASE_KEY, notif.id);
        return;
      }

      // 3. 各トークンに FCM (HTTP v1) で通知送信
      tokens.forEach(function (t) {
        sendFcmNotificationV1(
          FCM_PROJECT_ID,
          FCM_SA_CLIENT_EMAIL,
          FCM_SA_PRIVATE_KEY,
          t.token,
          notif.title,
          notif.body
        );
      });

      // 4. sent_at を更新して二重送信を防ぐ
      markNotificationSent(SUPABASE_URL, SUPABASE_KEY, notif.id);
    } catch (e) {
      console.error('通知送信中エラー id=' + notif.id, e);
    }
  });
}

/**
 * Supabase から「期限が来た未送信通知」を取得
 */
function fetchDueNotifications(SUPABASE_URL, SUPABASE_KEY, nowIso) {
  var url = SUPABASE_URL + '/rest/v1/notifications'
    + '?select=id,target_user_id,title,body,scheduled_at'
    + '&scheduled_at=lte.' + encodeURIComponent(nowIso)
    + '&sent_at=is.null';

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
    throw new Error('fetchDueNotifications error: ' + res.getContentText());
  }
  var data = JSON.parse(res.getContentText());
  return data;
}

/**
 * Supabase からユーザーの FCM トークン一覧を取得
 */
function fetchUserTokens(SUPABASE_URL, SUPABASE_KEY, userId) {
  var url = SUPABASE_URL + '/rest/v1/push_subscriptions'
    + '?select=token'
    + '&user_id=eq.' + encodeURIComponent(userId);

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
    throw new Error('fetchUserTokens error: ' + res.getContentText());
  }
  var data = JSON.parse(res.getContentText());
  return data;
}

/**
 * FCM HTTP v1 用のアクセストークンをサービスアカウントで取得
 */
function getFcmAccessToken_(projectId, clientEmail, privateKey) {
  // privateKey は Properties に保存するときに \n を含む文字列になりがちなので復元する
  var pk = privateKey.replace(/\\n/g, '\n');

  var now = Math.floor(new Date().getTime() / 1000);
  var jwtHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };
  var jwtClaimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1時間有効
  };

  function base64UrlEncode_(obj) {
    var str = Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
    return str;
  }

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
 * FCM HTTP v1 でプッシュ通知を送信
 */
function sendFcmNotificationV1(projectId, clientEmail, privateKey, token, title, body) {
  var accessToken = getFcmAccessToken_(projectId, clientEmail, privateKey);
  var url = 'https://fcm.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/messages:send';

  var payload = {
    message: {
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data: {
        // 必要なら任意データをここに
      },
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
  if (res.getResponseCode() >= 300) {
    console.error('FCM v1 送信エラー: ' + res.getContentText());
  } else {
    console.log('FCM v1 送信成功: ' + token);
  }
}

/**
 * 通知を「送信済み」にマークする
 */
function markNotificationSent(SUPABASE_URL, SUPABASE_KEY, notifId) {
  var url = SUPABASE_URL + '/rest/v1/notifications'
    + '?id=eq.' + encodeURIComponent(notifId);

  var body = {
    sent_at: new Date().toISOString(),
  };

  var options = {
    method: 'patch',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
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