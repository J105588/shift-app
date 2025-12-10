'use client'
import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns/format'
import { ja } from 'date-fns/locale/ja'
import { Send, MessageCircle, Reply, X, Image as ImageIcon, CheckCheck } from 'lucide-react'
import { ShiftGroupChatMessage } from '@/lib/types'

type ChatMessage = ShiftGroupChatMessage

type Props = {
  shiftGroupId: string
  currentUserId: string
  currentUserRole: 'admin' | 'staff'
  shiftEndTime: Date
  shiftTitle: string
  shiftStartTime: Date
}

export default function GroupChat({
  shiftGroupId,
  currentUserId,
  currentUserRole,
  shiftEndTime,
  shiftTitle,
  shiftStartTime
}: Props) {
  const supabase = createClient()
  const chatImageBucket = process.env.NEXT_PUBLIC_SUPABASE_CHAT_IMAGE_BUCKET || 'shift-chat-images'
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [canChat, setCanChat] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [readReceiptModal, setReadReceiptModal] = useState<ChatMessage | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const isAdmin = currentUserRole === 'admin'

  // チャットが利用可能かチェック（シフト終了後30分まで、管理者は常に利用可能）
  const checkChatAvailability = () => {
    if (isAdmin) {
      setCanChat(true)
      return true
    }
    const now = new Date()
    const chatEndTime = new Date(shiftEndTime.getTime() + 30 * 60 * 1000) // 30分後
    const isAvailable = now <= chatEndTime
    setCanChat(isAvailable)
    return isAvailable
  }

  // メッセージを取得
  const fetchMessages = async () => {
    try {
      // まず基本のメッセージを取得
      const { data, error } = await supabase
        .from('shift_group_chat_messages')
        .select(`
          *,
          profiles!shift_group_chat_messages_user_id_fkey(id, display_name),
          read_receipts:shift_group_chat_read_receipts(
            user_id,
            created_at,
            profiles!shift_group_chat_read_receipts_user_id_fkey(id, display_name)
          )
        `)
        .eq('shift_group_id', shiftGroupId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('メッセージ取得エラー:', error)
        return
      }

      if (!data) {
        setMessages([])
        return
      }

      // リプライ先のメッセージIDを収集
      const replyToIds = data
        .map(msg => msg.reply_to)
        .filter((id): id is string => id !== null && id !== undefined)

      // リプライ先のメッセージを一括取得
      let replyToMessages: Record<string, ChatMessage> = {}
      if (replyToIds.length > 0) {
        const { data: replyData } = await supabase
          .from('shift_group_chat_messages')
          .select(`
            id,
            message,
            user_id,
            profiles!shift_group_chat_messages_user_id_fkey(id, display_name)
          `)
          .in('id', replyToIds)

        if (replyData) {
          replyToMessages = replyData.reduce((acc, msg) => {
            acc[msg.id] = {
              ...msg,
              shift_group_id: '',
              created_at: '',
              profiles: Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles
            } as ChatMessage
            return acc
          }, {} as Record<string, ChatMessage>)
        }
      }

      // メッセージにリプライ先の情報を追加
      const messagesWithReplies = data.map(msg => ({
        ...msg,
        reply_to_message: msg.reply_to ? replyToMessages[msg.reply_to] || null : null
      })) as ChatMessage[]

      setMessages(messagesWithReplies)
      markMessagesAsRead(messagesWithReplies)
    } catch (error) {
      console.error('メッセージ取得エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 既読を記録
  const markMessagesAsRead = async (msgs: ChatMessage[]) => {
    const unreadMessages = msgs.filter(
      (m) =>
        m.user_id !== currentUserId &&
        !(m.read_receipts || []).some((r) => r.user_id === currentUserId)
    )

    if (unreadMessages.length === 0) return

    const payloads = unreadMessages.map((m) => ({
      message_id: m.id,
      user_id: currentUserId
    }))

    const { error } = await supabase
      .from('shift_group_chat_read_receipts')
      .upsert(payloads, { onConflict: 'message_id,user_id' })

    if (error) {
      console.error('既読登録エラー:', error)
    }
  }

  // メッセージ送信
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault()
    
    const hasContent = newMessage.trim().length > 0 || selectedFile !== null
    if (!hasContent || isSending || !canChat) return

    setIsSending(true)
    try {
      // チャット利用可能か再チェック
      if (!checkChatAvailability()) {
        alert('チャット機能はシフト終了後30分まで利用できます')
        setIsSending(false)
        return
      }

      const messageText = newMessage.trim() || (selectedFile ? '画像を送信しました' : '')
      let uploadedImageUrl: string | null = null

      if (selectedFile) {
        if (!selectedFile.type.startsWith('image/')) {
          alert('画像ファイルを選択してください')
          setIsSending(false)
          return
        }

        // ファイルサイズ上限: 5MB
        const maxSize = 5 * 1024 * 1024
        if (selectedFile.size > maxSize) {
          alert('画像サイズは5MB以下にしてください')
          setIsSending(false)
          return
        }

        const fileExt = selectedFile.name.split('.').pop() || 'jpg'
        const uniqueName = `${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()}-${selectedFile.name}`
        const sanitizedName = uniqueName.replace(/\s+/g, '_')
        const filePath = `${shiftGroupId}/${currentUserId}/${sanitizedName}`

        const { error: uploadError } = await supabase.storage
          .from(chatImageBucket)
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: selectedFile.type || `image/${fileExt}`
          })

        if (uploadError) {
          console.error('画像アップロードエラー:', uploadError)
          alert('画像のアップロードに失敗しました')
          setIsSending(false)
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from(chatImageBucket)
          .getPublicUrl(filePath)

        uploadedImageUrl = publicUrlData?.publicUrl || null
      }
      
      const { data: insertedData, error } = await supabase
        .from('shift_group_chat_messages')
        .insert({
          shift_group_id: shiftGroupId,
          user_id: currentUserId,
          message: messageText,
          reply_to: replyingTo?.id || null,
          image_url: uploadedImageUrl
        })
        .select('*, profiles!shift_group_chat_messages_user_id_fkey(id, display_name)')
        .single()

      if (error) {
        console.error('メッセージ送信エラー:', error)
        alert('メッセージの送信に失敗しました')
        setIsSending(false)
        return
      }

      // 送信後すぐにDBと同期するため、メッセージ一覧を再取得
      // リアルタイム購読もあるが、即座に反映させるために明示的に取得
      await fetchMessages()

      // 通知を送信（参加者全員に、送信者以外）
      // 通知は非同期で送信（送信のブロッキングを避ける）
      const notificationContent = uploadedImageUrl ? `${messageText} [画像]` : messageText
      sendChatNotification(notificationContent).catch((err) => {
        console.error('通知送信エラー:', err)
      })

      setNewMessage('')
      setSelectedFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setUploadError(null)
      setReplyingTo(null) // リプライ状態をリセット
    } catch (error) {
      console.error('メッセージ送信エラー:', error)
      alert('メッセージの送信に失敗しました')
    } finally {
      setIsSending(false)
    }
  }

  // チャット通知を送信（リアルタイム送信）
  const sendChatNotification = async (messageContent: string) => {
    try {
      // 送信者の情報を取得
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', currentUserId)
        .single()

      const senderName = senderProfile?.display_name || '不明'

      // シフトグループの参加者を取得
      const { data: assignments } = await supabase
        .from('shift_assignments')
        .select('user_id')
        .eq('shift_group_id', shiftGroupId)

      if (!assignments) return

      // 送信者以外の参加者に通知を送信
      const targetUserIds = assignments
        .map(a => a.user_id)
        .filter(id => id !== currentUserId)

      if (targetUserIds.length === 0) return

      // シフト時間のフォーマット
      const timeFormat = format(shiftStartTime, 'M/d HH:mm', { locale: ja }) + '〜' + format(shiftEndTime, 'HH:mm', { locale: ja })

      // 通知タイトルと本文を作成
      const notificationTitle = `${timeFormat}、${shiftTitle}`
      const notificationBody = `${senderName}：${messageContent}`

      // 通知を作成（即時送信）
      const nowIso = new Date().toISOString()
      const payloads = targetUserIds.map((userId) => ({
        target_user_id: userId,
        title: notificationTitle,
        body: notificationBody,
        scheduled_at: nowIso,
        shift_group_id: shiftGroupId, // チャットページへのリンク用
        created_by: currentUserId // 作成者を記録
      }))

      console.log('通知作成開始:', {
        payloadsCount: payloads.length,
        shiftGroupId: shiftGroupId,
        currentUserId: currentUserId,
        firstPayload: payloads[0]
      })

      // 認証状態を確認
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      console.log('認証状態確認:', {
        authUser: authUser?.id,
        currentUserId: currentUserId,
        authError: authError,
        match: authUser?.id === currentUserId
      })

      // shift_assignmentsの確認（デバッグ用）
      const { data: assignmentCheck, error: assignmentError } = await supabase
        .from('shift_assignments')
        .select('id, user_id, shift_group_id')
        .eq('shift_group_id', shiftGroupId)
        .eq('user_id', currentUserId)
      
      console.log('shift_assignments確認:', {
        assignmentCheck,
        assignmentError,
        isParticipant: assignmentCheck && assignmentCheck.length > 0
      })

      // セキュリティチェック: ユーザーがshift_assignmentsに存在しない場合は通知を作成しない
      if (!assignmentCheck || assignmentCheck.length === 0) {
        console.error('セキュリティエラー: ユーザーがshift_assignmentsに存在しません')
        return
      }

      // RLSをバイパスする関数を使用して通知を作成
      // アプリケーション側で既にshift_assignmentsのチェックを行っているため、
      // データベース側のRLSチェックは不要
      const { data: insertedNotifications, error: insertError } = await supabase
        .rpc('create_chat_notifications', {
          p_notifications: payloads.map(p => ({
            target_user_id: p.target_user_id,
            title: p.title,
            body: p.body,
            scheduled_at: p.scheduled_at,
            shift_group_id: p.shift_group_id,
            created_by: p.created_by
          }))
        })
      
      if (insertError) {
        console.error('通知作成エラー:', {
          error: insertError,
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          authUserId: authUser?.id,
          currentUserId: currentUserId,
          shiftGroupId: shiftGroupId,
          isParticipant: assignmentCheck && assignmentCheck.length > 0,
          payloads: payloads
        })
        return
      }

      // 通知IDを取得（配列として返される）
      const notificationIds: string[] = Array.isArray(insertedNotifications) 
        ? insertedNotifications.map((n: { id: string }) => n.id)
        : []

      if (notificationIds.length === 0) {
        console.warn('通知IDが取得できませんでした', {
          insertedNotifications,
          payloadsCount: payloads.length
        })
        return
      }

      console.log('通知作成成功:', {
        insertedCount: notificationIds.length,
        notificationIds: notificationIds
      })
      if (notificationIds.length === 0) {
        console.warn('通知IDが取得できませんでした')
        return
      }

      // GASのWebhookエンドポイントを呼び出して即座に送信
      const gasWebhookUrl = process.env.NEXT_PUBLIC_GAS_WEBHOOK_URL
      
      console.log('GAS Webhook URL:', gasWebhookUrl ? '設定されています' : '未設定')
      console.log('通知ID:', notificationIds)

      if (!gasWebhookUrl) {
        console.warn('NEXT_PUBLIC_GAS_WEBHOOK_URLが設定されていません。通知は通常のトリガーで送信されます。')
        return
      }

      try {
        console.log('GAS Webhookにリクエストを送信中...', gasWebhookUrl)
        
        const response = await fetch(gasWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notification_ids: notificationIds
          }),
          mode: 'no-cors' // CORSエラーを回避（GASのWebhookはno-corsが必要な場合がある）
        })

        // no-corsモードではresponseを読み取れないため、成功したとみなす
        console.log('GAS Webhookリクエスト送信完了')
      } catch (webhookError: any) {
        // Webhook呼び出しに失敗しても、通知は作成されているので、通常のトリガーで送信される
        console.error('GAS Webhook呼び出しエラー:', webhookError)
        console.error('エラー詳細:', {
          message: webhookError?.message,
          stack: webhookError?.stack,
          name: webhookError?.name
        })
      }
    } catch (error) {
      console.error('通知送信エラー:', error)
    }
  }

  // 初期化とリアルタイム購読
  useEffect(() => {
    if (!shiftGroupId) return

    checkChatAvailability()
    fetchMessages()

    // リアルタイム購読
    const channel = supabase
      .channel(`shift_group_chat_${shiftGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_group_chat_messages',
          filter: `shift_group_id=eq.${shiftGroupId}`
        },
        () => {
          fetchMessages()
        }
      )
      .subscribe()

    // 定期的にメッセージを取得（10秒ごと、リアルタイム購読の補完として）
    const messageInterval = setInterval(() => {
      fetchMessages()
    }, 10000)

    // 定期的にチャット利用可能かチェック（1分ごと）
    const availabilityInterval = setInterval(() => {
      checkChatAvailability()
    }, 60000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(messageInterval)
      clearInterval(availabilityInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftGroupId])

  // メッセージが更新されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ファイルプレビューのクリーンアップ
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('画像ファイルを選択してください')
      event.target.value = ''
      return
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setUploadError('画像サイズは5MB以下にしてください')
      event.target.value = ''
      return
    }

    setUploadError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const clearSelectedFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadError(null)
  }

  // チャット利用可能時間を計算
  const getChatEndTime = () => {
    const chatEndTime = new Date(shiftEndTime.getTime() + 30 * 60 * 1000)
    return format(chatEndTime, 'M/d HH:mm', { locale: ja })
  }

  if (isLoading) {
    return (
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="text-white" size={18} />
          <h3 className="text-white font-semibold text-sm">グループチャット</h3>
        </div>
        {!canChat && (
          <span className="text-xs text-white/90 bg-white/20 px-2 py-1 rounded">
            利用期限切れ
          </span>
        )}
      </div>

      {/* チャット利用可能時間の表示 */}
      {canChat && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <p className="text-xs text-blue-700">
            チャットは {getChatEndTime()} まで利用できます
          </p>
        </div>
      )}

      {/* メッセージ一覧 */}
      <div
        ref={chatContainerRef}
        className="h-[70vh] overflow-y-auto p-4 space-y-3 bg-white"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            まだメッセージがありません
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.user_id === currentUserId
            const senderName = msg.profiles?.display_name || '不明'
            const messageTime = format(new Date(msg.created_at), 'HH:mm', { locale: ja })
            const replyToMessage = msg.reply_to_message as ChatMessage | null
            const replyToSenderName = replyToMessage?.profiles?.display_name || '不明'
            // 既読情報: 自分のメッセージまたは管理者の場合は全て表示
            const canViewReadReceipts = isOwnMessage || isAdmin
            const readBy = canViewReadReceipts
              ? (msg.read_receipts || []).filter((r) => r.user_id !== msg.user_id)
              : []
            const readCount = readBy.length

            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} items-end gap-1`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    isOwnMessage
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {/* リプライ先のメッセージ表示 */}
                  {replyToMessage && (
                    <div
                      className={`text-xs mb-2 pb-2 border-b ${
                        isOwnMessage
                          ? 'border-white/30 text-white/80'
                          : 'border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <Reply size={12} />
                        <span className="font-semibold">{replyToSenderName}</span>
                      </div>
                      <div className="truncate mt-0.5">{replyToMessage.message}</div>
                    </div>
                  )}
                  
                  {!isOwnMessage && (
                    <div className="text-xs font-semibold mb-1 opacity-90">
                      {senderName}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.message}
                  </div>
                  {msg.image_url && (
                    <div className="mt-2">
                      <img
                        src={msg.image_url}
                        alt="共有された画像"
                        className={`rounded border ${
                          isOwnMessage ? 'border-white/40' : 'border-slate-200'
                        } max-h-64 object-contain`}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <div
                      className={`text-xs ${
                        isOwnMessage ? 'text-white/70' : 'text-slate-500'
                      }`}
                    >
                      {messageTime}
                    </div>
                    {canChat && (
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className={`ml-2 p-1 rounded hover:bg-opacity-20 transition-colors ${
                          isOwnMessage
                            ? 'hover:bg-white text-white/70 hover:text-white'
                            : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
                        }`}
                        title="リプライ"
                      >
                        <Reply size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {/* 自分のメッセージの場合のみ既読数を表示（メッセージボックスの外、左下） */}
                {isOwnMessage && readCount > 0 && (
                  <button
                    onClick={() => setReadReceiptModal(msg)}
                    className="text-[10px] text-slate-500 hover:text-slate-700 transition-colors mb-1"
                    title="既読一覧を表示"
                  >
                    既読{readCount}
                  </button>
                )}
                {/* 管理者の場合、全てのメッセージの既読数を表示 */}
                {isAdmin && !isOwnMessage && readCount > 0 && (
                  <button
                    onClick={() => setReadReceiptModal(msg)}
                    className="text-[10px] text-slate-500 hover:text-slate-700 transition-colors mb-1"
                    title="既読一覧を表示"
                  >
                    既読{readCount}
                  </button>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 既読一覧モーダル */}
      {readReceiptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">既読一覧</h3>
              <button
                onClick={() => setReadReceiptModal(null)}
                className="text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {readReceiptModal.read_receipts && readReceiptModal.read_receipts.length > 0 ? (
                <div className="space-y-2">
                  {readReceiptModal.read_receipts
                    .filter((r) => r.user_id !== readReceiptModal.user_id)
                    .map((receipt) => {
                      const readTime = format(new Date(receipt.created_at), 'M/d HH:mm', { locale: ja })
                      return (
                        <div
                          key={`${receipt.message_id}-${receipt.user_id}`}
                          className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {(receipt.profiles?.display_name || '不明').charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                {receipt.profiles?.display_name || '不明'}
                              </div>
                              <div className="text-xs text-slate-500">{readTime}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              ) : (
                <div className="text-center text-slate-500 py-8">
                  まだ既読がありません
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* メッセージ入力 */}
      {canChat ? (
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white">
          {/* リプライ先のメッセージ表示 */}
          {replyingTo && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-xs text-blue-700 font-semibold mb-1">
                  <Reply size={12} />
                  {replyingTo.profiles?.display_name || '不明'}にリプライ
                </div>
                <div className="text-xs text-blue-600 truncate">{replyingTo.message}</div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                title="リプライをキャンセル"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex gap-2 items-start">
            <div className="relative">
              <input
                id="chat-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isSending}
              />
              <label
                htmlFor="chat-image-input"
                className="flex items-center justify-center w-10 h-10 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors"
                title="画像を添付"
              >
                <ImageIcon size={18} />
              </label>
            </div>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={replyingTo ? `${replyingTo.profiles?.display_name || '不明'}にリプライ...` : 'メッセージを入力...'}
              className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
              disabled={isSending}
              maxLength={500}
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && !selectedFile) || isSending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          {(selectedFile || uploadError) && (
            <div className="mt-2 flex items-center gap-3">
              {selectedFile && (
                <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs">
                  <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    className="text-slate-500 hover:text-slate-800"
                    title="添付を削除"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="プレビュー"
                  className="h-12 w-12 object-cover rounded border border-slate-200"
                />
              )}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">
            {newMessage.length}/500文字
          </p>
        </form>
      ) : (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-600 text-center">
            チャット機能はシフト終了後30分まで利用できます
          </p>
        </div>
      )}
    </div>
  )
}

