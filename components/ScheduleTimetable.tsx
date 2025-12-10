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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week')
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // 週の開始日と終了日を計算
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }) // 月曜日開始
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // 選択された日付のイベントを取得
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    return events
      .filter(event => isSameDay(event.start, selectedDate))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [events, selectedDate])

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

    if (isLeftSwipe && viewMode === 'week') {
      handleNextWeek()
    }
    if (isRightSwipe && viewMode === 'week') {
      handlePrevWeek()
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
                  className={`border-r border-slate-200 last:border-r-0 ${
                    isDayToday ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  {/* 日付ヘッダー */}
                  <div
                    className={`p-3 text-center border-b border-slate-200 cursor-pointer transition-colors ${
                      isDayToday
                        ? 'bg-blue-100 border-blue-300'
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => handleDateClick(day)}
                  >
                    <div className={`text-xs font-semibold mb-1 ${
                      isDayToday ? 'text-blue-700' : 'text-slate-600'
                    }`}>
                      {format(day, 'E', { locale: ja })}
                    </div>
                    <div className={`text-lg font-bold ${
                      isDayToday ? 'text-blue-700' : 'text-slate-900'
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
                        {eventsForDay.map((event) => (
                          <div
                            key={event.id}
                            className={`p-2 rounded-lg text-xs cursor-pointer transition-all hover:shadow-md ${
                              isMyShift(event)
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation() // 親要素のクリックイベントを防ぐ
                              onEventClick?.(event)
                            }}
                          >
                            <div className="font-semibold mb-1 flex items-center gap-1">
                              <Clock size={12} />
                              {formatTime(event.start)} - {formatTime(event.end)}
                            </div>
                            <div className="text-xs opacity-90">
                              {event.shiftTitle || event.title || event.displayName}
                            </div>
                          </div>
                        ))}
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
                  className={`border-b border-slate-200 ${
                    isDayToday ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  {/* 日付ヘッダー */}
                  <div
                    className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                      isDayToday ? 'bg-blue-100' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => handleDateClick(day)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center ${
                        isDayToday ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
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
                            className={`p-3 rounded-lg cursor-pointer transition-all active:scale-95 ${
                              isMyShift(event) ? 'shadow-md' : 'border-2'
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

  // 日ビュー
  if (viewMode === 'day' && selectedDate) {
    return (
      <div className="w-full min-h-[400px]">
        {/* ヘッダーコントロール */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg p-4 border-b border-blue-200">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <button
              onClick={() => {
                setViewMode('week')
                setSelectedDate(null)
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm sm:text-base font-semibold bg-blue-600 text-white rounded-lg border border-blue-700 hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md touch-manipulation"
            >
              <ChevronLeft size={18} />
              <span>週表示に戻る</span>
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const prevDay = new Date(selectedDate)
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
                className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors touch-manipulation"
              >
                今日
              </button>
              <button
                onClick={() => {
                  const nextDay = new Date(selectedDate)
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
              {formatDateFull(selectedDate)}
              {isToday(selectedDate) && (
                <span className="ml-2 text-blue-600 font-normal">(今日)</span>
              )}
            </h3>
            <div className="text-sm text-slate-600">
              {selectedDateEvents.length}件のシフト
            </div>
          </div>
        </div>

        {/* 日詳細ビュー */}
        <div className="bg-white rounded-b-lg p-4 sm:p-6">
          {selectedDateEvents.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500 font-medium">この日はシフトがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateEvents.map((event) => (
                <div
                  key={event.id}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                    isMyShift(event)
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400 shadow-lg'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => onEventClick?.(event)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isMyShift(event) ? 'bg-blue-400' : 'bg-blue-50'
                      }`}>
                        <Clock size={20} className={isMyShift(event) ? 'text-white' : 'text-blue-600'} />
                      </div>
                      <div>
                        <div className={`font-bold text-lg ${
                          isMyShift(event) ? 'text-white' : 'text-slate-900'
                        }`}>
                          {formatTime(event.start)} - {formatTime(event.end)}
                        </div>
                        <div className={`text-sm mt-1 ${
                          isMyShift(event) ? 'text-blue-100' : 'text-slate-600'
                        }`}>
                          {formatDate(event.start)}
                        </div>
                      </div>
                    </div>
                    {isMyShift(event) && (
                      <span className="px-3 py-1 bg-blue-700 text-white text-xs font-bold rounded-full">
                        あなたのシフト
                      </span>
                    )}
                  </div>
                  
                  <div className={`flex items-center gap-2 mt-3 pt-3 border-t ${
                    isMyShift(event) ? 'border-blue-400' : 'border-slate-200'
                  }`}>
                    <User size={16} className={isMyShift(event) ? 'text-blue-100' : 'text-slate-400'} />
                    <span className={`font-semibold ${
                      isMyShift(event) ? 'text-white' : 'text-slate-900'
                    }`}>
                      {event.shiftTitle || event.title || event.displayName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
