'use client'
import { useState, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday } from 'date-fns'
import { ja } from 'date-fns/locale/ja'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User } from 'lucide-react'
import { getTextColor } from '@/lib/colorUtils'

type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  resourceId: string
  displayName?: string
  shiftTitle?: string
  description?: string
}

type Props = {
  events: CalendarEvent[]
  currentUserId: string
  onDateChange?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
}

export default function ScheduleTimetable({ events, currentUserId, onDateChange, onEventClick }: Props) {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  // デフォルトを今日の日付にし、表示モードも'day'をデフォルトにする
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'day'>('day')
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // 現在時刻の更新（1分ごと）
  useState(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  })

  // 週の開始日と終了日を計算
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }) // 月曜日開始
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // 選択された日付のイベントを取得
  const selectedDateEvents = useMemo(() => {
    // selectedDateがnullの場合はcurrentWeek（実質今日）を使う
    const date = selectedDate || currentWeek
    return events
      .filter(event => isSameDay(event.start, date))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [events, selectedDate, currentWeek])

  // 週の各日のイベントを取得
  const dayEvents = useMemo(() => {
    const dayMap = new Map<string, CalendarEvent[]>()
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd')
      const dayEventsList = events
        .filter(event => isSameDay(event.start, day))
        .sort((a, b) => a.start.getTime() - b.start.getTime())
      dayMap.set(dayKey, dayEventsList)
    })
    return dayMap
  }, [events, weekDays])

  const handlePrevWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1))
  }

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentWeek(today)
    setSelectedDate(today)
    onDateChange?.(today)
  }

  // スワイプジェスチャー処理
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (viewMode === 'week') {
      if (isLeftSwipe) handleNextWeek()
      if (isRightSwipe) handlePrevWeek()
    } else if (viewMode === 'day' && selectedDate) {
      if (isLeftSwipe) {
        const nextDay = new Date(selectedDate)
        nextDay.setDate(nextDay.getDate() + 1)
        setSelectedDate(nextDay)
        setCurrentWeek(nextDay)
      }
      if (isRightSwipe) {
        const prevDay = new Date(selectedDate)
        prevDay.setDate(prevDay.getDate() - 1)
        setSelectedDate(prevDay)
        setCurrentWeek(prevDay)
      }
    }
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setViewMode('day')
    onDateChange?.(date)
  }

  const formatTime = (date: Date) => {
    return format(date, 'HH:mm', { locale: ja })
  }

  const formatDate = (date: Date) => {
    return format(date, 'M/d(E)', { locale: ja })
  }

  const formatDateFull = (date: Date) => {
    return format(date, 'yyyy年M月d日(E)', { locale: ja })
  }

  const isMyShift = (event: CalendarEvent) => {
    return event.resourceId === currentUserId
  }

  // タイムテーブルの生成用定数
  const START_HOUR = 6 // 6時から
  const END_HOUR = 22  // 22時まで
  const HOUR_HEIGHT = 60 // 1時間あたりの高さ(px)

  // イベントの位置計算
  const getEventStyle = (event: CalendarEvent) => {
    const startHour = event.start.getHours()
    const startMin = event.start.getMinutes()
    const endHour = event.end.getHours()
    const endMin = event.end.getMinutes()

    // 開始位置（分計算）
    const startMinutes = (startHour - START_HOUR) * 60 + startMin
    const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)

    // スタイル
    const top = (startMinutes / 60) * HOUR_HEIGHT
    const height = (durationMinutes / 60) * HOUR_HEIGHT

    return {
      top: `${Math.max(0, top)}px`,
      height: `${Math.max(20, height)}px`, // 最小高さを確保
    }
  }

  // 現在時刻線の位置計算
  const getCurrentTimeTop = () => {
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()
    const totalMinutes = (hours - START_HOUR) * 60 + minutes
    return (totalMinutes / 60) * HOUR_HEIGHT
  }

  // 週ビュー
  if (viewMode === 'week') {
    return (
      <div className="w-full min-h-[600px]">
        {/* ヘッダーコントロール */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg p-4 border-b border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="text-blue-600" size={20} />
              シフト一覧
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const targetDate = selectedDate ?? new Date()
                  setSelectedDate(targetDate)
                  setViewMode('day')
                  onDateChange?.(targetDate)
                }}
                className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                日表示
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                今日
              </button>
            </div>
          </div>

          {/* 週ナビゲーション */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevWeek}
              className="p-2 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors touch-manipulation"
              aria-label="前の週"
            >
              <ChevronLeft className="text-blue-600" size={20} />
            </button>
            <div className="text-center flex-1 px-4">
              <div className="text-sm sm:text-base font-semibold text-slate-900">
                {format(weekStart, 'yyyy年M月d日', { locale: ja })} 〜 {format(weekEnd, 'M月d日', { locale: ja })}
              </div>
            </div>
            <button
              onClick={handleNextWeek}
              className="p-2 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors touch-manipulation"
              aria-label="次の週"
            >
              <ChevronRight className="text-blue-600" size={20} />
            </button>
          </div>
        </div>

        {/* 週カレンダー */}
        <div
          className="bg-white rounded-b-lg overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* デスクトップ: 横並び表示 */}
          <div className="hidden md:grid md:grid-cols-7 border-b border-slate-200">
            {weekDays.map((day, index) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const eventsForDay = dayEvents.get(dayKey) || []
              const isDayToday = isToday(day)

              return (
                <div
                  key={dayKey}
                  className={`border-r border-slate-200 last:border-r-0 ${isDayToday ? 'bg-blue-50' : 'bg-white'
                    }`}
                >
                  {/* 日付ヘッダー */}
                  <div
                    className={`p-3 text-center border-b border-slate-200 cursor-pointer transition-colors ${isDayToday
                      ? 'bg-blue-100 border-blue-300'
                      : 'hover:bg-slate-50'
                      }`}
                    onClick={() => handleDateClick(day)}
                  >
                    <div className={`text-xs font-semibold mb-1 ${isDayToday ? 'text-blue-700' : 'text-slate-600'
                      }`}>
                      {format(day, 'E', { locale: ja })}
                    </div>
                    <div className={`text-lg font-bold ${isDayToday ? 'text-blue-700' : 'text-slate-900'
                      }`}>
                      {format(day, 'd')}
                    </div>
                  </div>

                  {/* イベントリスト */}
                  <div
                    className="p-2 min-h-[400px] max-h-[500px] overflow-y-auto"
                    onClick={() => handleDateClick(day)}
                  >
                    {eventsForDay.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-4">
                        シフトなし
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {eventsForDay.map((event) => {
                          const eventColor = (event as any).color || (isMyShift(event) ? '#3b82f6' : '#64748b')
                          const textColor = getTextColor(eventColor)

                          return (
                            <div
                              key={event.id}
                              className={`p-2 rounded-lg text-xs cursor-pointer transition-all hover:shadow-md ${isMyShift(event) ? '' : 'border'
                                }`}
                              style={{
                                backgroundColor: isMyShift(event) ? eventColor : '#ffffff',
                                borderColor: isMyShift(event) ? eventColor : eventColor,
                                color: textColor,
                              }}
                              onClick={(e) => {
                                e.stopPropagation() // 親要素のクリックイベントを防ぐ
                                onEventClick?.(event)
                              }}
                            >
                              <div className="font-semibold mb-1 flex items-center gap-1">
                                <Clock size={12} style={{ color: isMyShift(event) ? textColor : eventColor }} />
                                {formatTime(event.start)} - {formatTime(event.end)}
                              </div>
                              <div className="text-xs opacity-90">
                                {event.shiftTitle || event.title || event.displayName}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* モバイル: 縦スクロール表示 */}
          <div className="md:hidden">
            {weekDays.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const eventsForDay = dayEvents.get(dayKey) || []
              const isDayToday = isToday(day)

              return (
                <div
                  key={dayKey}
                  className={`border-b border-slate-200 ${isDayToday ? 'bg-blue-50' : 'bg-white'
                    }`}
                >
                  {/* 日付ヘッダー */}
                  <div
                    className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${isDayToday ? 'bg-blue-100' : 'hover:bg-slate-50'
                      }`}
                    onClick={() => handleDateClick(day)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center ${isDayToday ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                        <div className="text-xs font-semibold">
                          {format(day, 'E', { locale: ja })}
                        </div>
                        <div className="text-lg font-bold">
                          {format(day, 'd')}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">
                          {formatDateFull(day)}
                        </div>
                        <div className="text-sm text-slate-600">
                          {eventsForDay.length}件のシフト
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-400" size={20} />
                  </div>

                  {/* イベントリスト（折りたたみ可能） */}
                  {eventsForDay.length > 0 && (
                    <div className="px-4 pb-4 space-y-2">
                      {eventsForDay.map((event) => {
                        const eventColor = (event as any).color || (isMyShift(event) ? '#3b82f6' : '#64748b')
                        const textColor = getTextColor(eventColor)

                        return (
                          <div
                            key={event.id}
                            className={`p-3 rounded-lg cursor-pointer transition-all active:scale-95 ${isMyShift(event) ? 'shadow-md' : 'border-2'
                              }`}
                            style={{
                              backgroundColor: isMyShift(event) ? eventColor : '#ffffff',
                              borderColor: isMyShift(event) ? eventColor : eventColor,
                              color: isMyShift(event) ? textColor : '#1e293b',
                            }}
                            onClick={(e) => {
                              e.stopPropagation() // 親要素のクリックイベントを防ぐ
                              onEventClick?.(event)
                            }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Clock size={16} style={{ color: isMyShift(event) ? textColor : eventColor }} />
                                <span className="font-bold text-sm" style={{ color: isMyShift(event) ? textColor : '#1e293b' }}>
                                  {formatTime(event.start)} - {formatTime(event.end)}
                                </span>
                              </div>
                              {isMyShift(event) && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: eventColor, color: textColor }}>
                                  あなた
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-medium" style={{ color: isMyShift(event) ? textColor : '#1e293b' }}>
                              {event.shiftTitle || event.title || event.displayName}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // 日ビュー（タイムテーブル）
  // selectedDateまたはcurrentWeek（今日）を表示
  const targetDate = selectedDate || currentWeek

  return (
    <div className="w-full">
      {/* ヘッダーコントロール */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg p-4 border-b border-blue-200">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <button
            onClick={() => {
              setViewMode('week')
              setSelectedDate(null)
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm sm:text-base font-semibold bg-white text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors shadow-sm touch-manipulation"
          >
            <ChevronLeft size={18} />
            <span>週表示</span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const prevDay = new Date(targetDate)
                prevDay.setDate(prevDay.getDate() - 1)
                setSelectedDate(prevDay)
                setCurrentWeek(prevDay)
              }}
              className="p-2 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors touch-manipulation"
              aria-label="前の日"
            >
              <ChevronLeft className="text-blue-600" size={20} />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-2 text-xs sm:text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation"
            >
              今日
            </button>
            <button
              onClick={() => {
                const nextDay = new Date(targetDate)
                nextDay.setDate(nextDay.getDate() + 1)
                setSelectedDate(nextDay)
                setCurrentWeek(nextDay)
              }}
              className="p-2 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors touch-manipulation"
              aria-label="次の日"
            >
              <ChevronRight className="text-blue-600" size={20} />
            </button>
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
            {formatDateFull(targetDate)}
            {isToday(targetDate) && (
              <span className="ml-2 text-blue-600 font-normal">(今日)</span>
            )}
          </h3>
          <div className="text-sm text-slate-600">
            {selectedDateEvents.length}件のシフト
          </div>
        </div>
      </div>

      {/* タイムテーブルビュー */}
      <div
        className="bg-white rounded-b-lg overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex h-full overflow-y-hidden" style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT + 40}px` }}> {/* 下部余白 */}

          {/* 時間軸 */}
          <div className="w-14 flex-shrink-0 border-r border-slate-100 bg-slate-50">
            {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
              const hour = START_HOUR + i
              return (
                <div
                  key={hour}
                  className="relative border-b border-slate-100 text-right pr-2 text-xs text-slate-500 font-medium"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="-top-2.5 relative block bg-slate-50">{hour}:00</span>
                </div>
              )
            })}
          </div>

          {/* メイングリッド */}
          <div className="flex-1 relative overflow-y-hidden">
            {/* グリッド線 */}
            {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
              const hour = START_HOUR + i
              return (
                <div
                  key={hour}
                  className="border-b border-slate-100 w-full"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                />
              )
            })}

            {/* 現在時刻線 (今日の場合のみ) */}
            {isToday(targetDate) && (
              <div
                className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none"
                style={{ top: `${getCurrentTimeTop()}px` }}
              >
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
              </div>
            )}

            {/* イベント配置 */}
            {selectedDateEvents.map((event) => {
              const style = getEventStyle(event)
              const eventColor = (event as any).color || (isMyShift(event) ? '#3b82f6' : '#64748b')
              const textColor = getTextColor(eventColor)
              const isShort = parseInt(style.height) < 40 // 短いイベント用

              return (
                <div
                  key={event.id}
                  className={`absolute left-1 right-1 sm:left-2 sm:right-2 rounded-lg p-2 cursor-pointer transition-all hover:shadow-lg active:scale-[0.99] border-l-4 overflow-hidden z-10 ${isMyShift(event) ? 'shadow-md shadow-blue-100' : 'opacity-90'
                    }`}
                  style={{
                    top: style.top,
                    height: style.height,
                    backgroundColor: addOpacity(eventColor, 0.15),
                    borderColor: eventColor,
                    color: '#1e293b' // テキストは読みやすさ重視で濃い色に
                  }}
                  onClick={() => onEventClick?.(event)}
                >
                  <div className={`flex ${isShort ? 'items-center gap-2' : 'flex-col'} h-full`}>
                    <div className="flex items-center gap-1 font-bold text-xs sm:text-sm text-slate-700">
                      <Clock size={12} className="text-slate-500" />
                      {formatTime(event.start)} - {formatTime(event.end)}
                    </div>

                    <div className={`font-bold text-sm sm:text-base leading-tight ${isShort ? 'truncate' : 'mt-1'}`} style={{ color: eventColor }}>
                      {event.shiftTitle || event.title || event.displayName}
                    </div>

                    {!isShort && (
                      <div className="mt-auto pt-1 flex items-center justify-between">
                        {isMyShift(event) && (
                          <span className="inline-block px-2 py-0.5 bg-blue-600 text-white text-[10px] rounded-full font-bold">
                            あなた
                          </span>
                        )}
                        <User size={14} style={{ color: eventColor }} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* シフトがない場合の表示 */}
            {selectedDateEvents.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center p-6 bg-white/80 rounded-xl backdrop-blur-sm shadow-sm border border-slate-100">
                  <CalendarIcon className="mx-auto text-slate-300 mb-2" size={40} />
                  <p className="text-slate-400 font-medium text-sm">シフトはありません</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// カラーユーティリティのインポート用（もし未定義なら）
function addOpacity(hex: string, opacity: number): string {
  // #RRGGBB形式を想定
  if (!hex) return 'rgba(0,0,0,0.1)';
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})` : hex;
}
