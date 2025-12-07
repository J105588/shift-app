'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns/format'
import { ja } from 'date-fns/locale/ja'
import { MessageCircle, Trash2, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
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

  useEffect(() => {
    fetchChatGroups()
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

                {/* メッセージ一覧 */}
                {isExpanded && selectedGroupId === group.id && (
                  <div className="border-t border-slate-200 bg-white">
                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        メッセージがありません
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto p-4 space-y-3">
                        {messages.map((msg) => {
                          const isOwnMessage = false // 管理者視点なので常にfalse
                          const senderName = msg.profiles?.display_name || '不明'
                          const messageTime = format(new Date(msg.created_at), 'M/d HH:mm', { locale: ja })

                          return (
                            <div
                              key={msg.id}
                              className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {senderName}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {messageTime}
                                  </span>
                                </div>
                                <div className="text-sm text-slate-800 whitespace-pre-wrap break-words">
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
                        })}
                      </div>
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

