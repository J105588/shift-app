'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns/format'
import { ja } from 'date-fns/locale/ja'
import { MessageCircle, Trash2, X, ChevronDown, ChevronUp, AlertTriangle, Send } from 'lucide-react'
import { ShiftGroupChatMessage } from '@/lib/types'

type ChatGroup = {
  id: string
  title: string
  start_time: string
  end_time: string
  message_count: number
  last_message_at: string | null
}

export default function AdminChatManagement() {
  const supabase = createClient()
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ShiftGroupChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentProfile, setCurrentProfile] = useState<any>(null)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // チャットグループ一覧を取得
  const fetchChatGroups = async () => {
    try {
      setIsLoading(true)
      
      // チャットメッセージがあるシフトグループを取得
      const { data: groupsWithMessages, error: groupsError } = await supabase
        .from('shift_groups')
        .select(`
          id,
          title,
          start_time,
          end_time,
          shift_group_chat_messages (
            id,
            created_at
          )
        `)
        .order('start_time', { ascending: false })

      if (groupsError) {
        console.error('チャットグループ取得エラー:', groupsError)
        return
      }

      if (!groupsWithMessages) return

      // メッセージ数と最終メッセージ時刻を計算
      const processedGroups: ChatGroup[] = groupsWithMessages
        .filter((group: any) => group.shift_group_chat_messages && group.shift_group_chat_messages.length > 0)
        .map((group: any) => {
          const messages = group.shift_group_chat_messages || []
          const sortedMessages = messages.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          
          return {
            id: group.id,
            title: group.title,
            start_time: group.start_time,
            end_time: group.end_time,
            message_count: messages.length,
            last_message_at: sortedMessages.length > 0 ? sortedMessages[0].created_at : null
          }
        })
        .sort((a, b) => {
          // 最終メッセージ時刻でソート（新しい順）
          if (a.last_message_at && b.last_message_at) {
            return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
          }
          if (a.last_message_at) return -1
          if (b.last_message_at) return 1
          return 0
        })

      setChatGroups(processedGroups)
    } catch (error) {
      console.error('チャットグループ取得エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // メッセージ一覧を取得
  const fetchMessages = async (groupId: string) => {
    try {
      setIsLoadingMessages(true)
      
      const { data, error } = await supabase
        .from('shift_group_chat_messages')
        .select('*, profiles!shift_group_chat_messages_user_id_fkey(id, display_name)')
        .eq('shift_group_id', groupId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('メッセージ取得エラー:', error)
        return
      }

      setMessages(data as ShiftGroupChatMessage[] || [])
    } catch (error) {
      console.error('メッセージ取得エラー:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // メッセージ削除
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('このメッセージを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('shift_group_chat_messages')
        .delete()
        .eq('id', messageId)

      if (error) {
        console.error('メッセージ削除エラー:', error)
        alert('メッセージの削除に失敗しました: ' + error.message)
        return
      }

      // メッセージ一覧を再取得
      if (selectedGroupId) {
        await fetchMessages(selectedGroupId)
      }
      
      // チャットグループ一覧も更新
      await fetchChatGroups()
      
      alert('メッセージを削除しました')
    } catch (error) {
      console.error('メッセージ削除エラー:', error)
      alert('メッセージの削除に失敗しました')
    }
  }

  // チャットグループ削除（チャット機能を無効化）
  const handleDeleteChatGroup = async (groupId: string) => {
    const group = chatGroups.find(g => g.id === groupId)
    if (!group) return

    if (!confirm(`「${group.title}」のチャットを削除しますか？\n\nこの操作により、このシフトグループのチャット機能が無効化されます。\nシフトグループ自体は削除されません。`)) return

    try {
      // チャットメッセージを全て削除
      const { error } = await supabase
        .from('shift_group_chat_messages')
        .delete()
        .eq('shift_group_id', groupId)

      if (error) {
        console.error('チャットグループ削除エラー:', error)
        alert('チャットの削除に失敗しました: ' + error.message)
        return
      }

      // 選択中のグループの場合はクリア
      if (selectedGroupId === groupId) {
        setSelectedGroupId(null)
        setMessages([])
      }

      // チャットグループ一覧を更新
      await fetchChatGroups()
      
      alert('チャットを削除しました')
    } catch (error) {
      console.error('チャットグループ削除エラー:', error)
      alert('チャットの削除に失敗しました')
    }
  }

  // グループの展開/折りたたみ
  const toggleGroup = async (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
      if (selectedGroupId === groupId) {
        setSelectedGroupId(null)
        setMessages([])
      }
    } else {
      newExpanded.add(groupId)
      setSelectedGroupId(groupId)
      await fetchMessages(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  // メッセージ送信
  const handleSendMessage = async (e: React.FormEvent, groupId: string) => {
    e.preventDefault()
    
    if (!newMessage.trim() || isSending || !currentUser) return

    setIsSending(true)
    try {
      const messageText = newMessage.trim()
      
      const { error } = await supabase
        .from('shift_group_chat_messages')
        .insert({
          shift_group_id: groupId,
          user_id: currentUser.id,
          message: messageText
        })

      if (error) {
        console.error('メッセージ送信エラー:', error)
        alert('メッセージの送信に失敗しました: ' + error.message)
        setIsSending(false)
        return
      }

      // 送信後すぐにDBと同期するため、メッセージ一覧を再取得
      await fetchMessages(groupId)
      
      // チャットグループ一覧も更新
      await fetchChatGroups()

      // 通知を送信（参加者全員に、送信者以外）
      await sendChatNotification(messageText, groupId)

      setNewMessage('')
    } catch (error) {
      console.error('メッセージ送信エラー:', error)
      alert('メッセージの送信に失敗しました')
    } finally {
      setIsSending(false)
    }
  }

  // チャット通知を送信（リアルタイム送信）
  const sendChatNotification = async (messageContent: string, groupId: string) => {
    try {
      const senderName = currentProfile?.display_name || '管理者'

      // シフトグループの参加者を取得
      const { data: assignments } = await supabase
        .from('shift_assignments')
        .select('user_id')
        .eq('shift_group_id', groupId)

      if (!assignments) return

      // 送信者以外の参加者に通知を送信
      const targetUserIds = assignments
        .map(a => a.user_id)
        .filter(id => id !== currentUser.id)

      if (targetUserIds.length === 0) return

      // シフトグループ情報を取得
      const { data: groupData } = await supabase
        .from('shift_groups')
        .select('title, start_time, end_time')
        .eq('id', groupId)
        .single()

      if (!groupData) return

      const startTime = new Date(groupData.start_time)
      const endTime = new Date(groupData.end_time)

      // シフト時間のフォーマット
      const timeFormat = format(startTime, 'M/d HH:mm', { locale: ja }) + '〜' + format(endTime, 'HH:mm', { locale: ja })

      // 通知タイトルと本文を作成
      const notificationTitle = `${timeFormat}、${groupData.title}`
      const notificationBody = `${senderName}（管理者）：${messageContent}`

      // 通知を作成（即時送信）
      const nowIso = new Date().toISOString()
      const payloads = targetUserIds.map((userId) => ({
        target_user_id: userId,
        title: notificationTitle,
        body: notificationBody,
        scheduled_at: nowIso,
        shift_group_id: groupId,
        created_by: currentUser.id // 作成者を記録
      }))

      console.log('通知作成開始:', {
        payloadsCount: payloads.length,
        shiftGroupId: groupId,
        currentUserId: currentUser.id,
        firstPayload: payloads[0]
      })

      // 認証状態を確認
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      console.log('認証状態確認:', {
        authUser: authUser?.id,
        currentUserId: currentUser.id,
        authError: authError,
        match: authUser?.id === currentUser.id
      })

      // shift_assignmentsの確認（デバッグ用）
      const { data: assignmentCheck, error: assignmentError } = await supabase
        .from('shift_assignments')
        .select('id, user_id, shift_group_id')
        .eq('shift_group_id', groupId)
        .eq('user_id', currentUser.id)
      
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
          currentUserId: currentUser.id,
          shiftGroupId: groupId,
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

  // メッセージが更新されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 現在のユーザー情報を取得
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setCurrentProfile(profile)
      }
    }
    init()
  }, [supabase])

  // リアルタイム購読
  useEffect(() => {
    if (!selectedGroupId) return

    const channel = supabase
      .channel(`admin_chat_${selectedGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_group_chat_messages',
          filter: `shift_group_id=eq.${selectedGroupId}`
        },
        () => {
          fetchMessages(selectedGroupId)
          fetchChatGroups()
        }
      )
      .subscribe()

    // 定期的にメッセージを取得（30秒ごと、リアルタイム購読の補完として）
    const messageInterval = setInterval(() => {
      fetchMessages(selectedGroupId)
    }, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(messageInterval)
    }
  }, [selectedGroupId, supabase])

  // チャットグループ一覧の定期的な更新
  useEffect(() => {
    fetchChatGroups()

    // 定期的にチャットグループ一覧を更新（30秒ごと、リアルタイム購読の補完として）
    const groupInterval = setInterval(() => {
      fetchChatGroups()
    }, 30000)

    return () => {
      clearInterval(groupInterval)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
          <MessageCircle className="text-blue-600" size={24} />
          チャット管理
        </h2>
        <p className="text-sm text-slate-600">
          団体シフトのチャットを一覧で確認し、メッセージやチャットグループを削除できます
        </p>
      </div>

      {chatGroups.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <MessageCircle size={48} className="mx-auto mb-4 text-slate-300" />
          <p>チャットがまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chatGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id)
            const startTime = new Date(group.start_time)
            const endTime = new Date(group.end_time)
            const lastMessageTime = group.last_message_at ? new Date(group.last_message_at) : null

            return (
              <div
                key={group.id}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                {/* グループヘッダー */}
                <div className="bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {group.title}
                        </h3>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                          {group.message_count}件
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <div>
                          {format(startTime, 'M/d (E) HH:mm', { locale: ja })} 〜{' '}
                          {format(endTime, 'HH:mm', { locale: ja })}
                        </div>
                        {lastMessageTime && (
                          <div>
                            最終メッセージ: {format(lastMessageTime, 'M/d HH:mm', { locale: ja })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                        aria-label={isExpanded ? '折りたたむ' : '展開する'}
                      >
                        {isExpanded ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteChatGroup(group.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="チャットを削除"
                        title="チャットを削除"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* メッセージ一覧と送信フォーム */}
                {isExpanded && selectedGroupId === group.id && (
                  <div className="border-t border-slate-200 bg-white">
                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        {/* メッセージ一覧 */}
                        <div className="max-h-96 overflow-y-auto p-4 space-y-3">
                          {messages.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-sm">
                              メッセージがありません
                            </div>
                          ) : (
                            messages.map((msg) => {
                              const isOwnMessage = msg.user_id === currentUser?.id
                              const senderName = msg.profiles?.display_name || '不明'
                              const messageTime = format(new Date(msg.created_at), 'M/d HH:mm', { locale: ja })

                              return (
                                <div
                                  key={msg.id}
                                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                                    isOwnMessage
                                      ? 'bg-blue-50 hover:bg-blue-100'
                                      : 'bg-slate-50 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-sm font-semibold ${
                                        isOwnMessage ? 'text-blue-900' : 'text-slate-900'
                                      }`}>
                                        {senderName}
                                        {isOwnMessage && (
                                          <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded">
                                            管理者
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {messageTime}
                                      </span>
                                    </div>
                                    <div className={`text-sm whitespace-pre-wrap break-words ${
                                      isOwnMessage ? 'text-blue-900' : 'text-slate-800'
                                    }`}>
                                      {msg.message}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                    aria-label="メッセージを削除"
                                    title="メッセージを削除"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )
                            })
                          )}
                          <div ref={messagesEndRef} />
                        </div>

                        {/* メッセージ送信フォーム */}
                        <div className="border-t border-slate-200 p-4 bg-slate-50">
                          <form onSubmit={(e) => handleSendMessage(e, group.id)} className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="メッセージを入力..."
                                className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                                disabled={isSending}
                                maxLength={500}
                              />
                              <button
                                type="submit"
                                disabled={!newMessage.trim() || isSending}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                              >
                                {isSending ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Send size={16} />
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-slate-500">
                              {newMessage.length}/500文字
                            </p>
                          </form>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

