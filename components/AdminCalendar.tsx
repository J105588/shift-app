'use client'
import { useState, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday, startOfDay } from 'date-fns'
import { ja } from 'date-fns/locale/ja'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Clock } from 'lucide-react'

type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  resource: any
}

type Props = {
  events: CalendarEvent[]
  onSelectSlot: (start: Date) => void
  onSelectEvent: (event: CalendarEvent) => void
  currentView?: 'week' | 'day'
}

export default function AdminCalendar({ events, onSelectSlot, onSelectEvent, currentView = 'week' }: Props) {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'week' | 'day'>(currentView)
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
  }

  const handleAddShift = (date: Date) => {
    const dateWithTime = new Date(date)
    dateWithTime.setHours(9, 0, 0, 0)
    onSelectSlot(dateWithTime)
  }

  const formatTime = (date: Date) => {
    return format(date, 'HH:mm', { locale: ja })
  }

  const formatDateFull = (date: Date) => {
    return format(date, 'yyyy年M月d日(E)', { locale: ja })
  }

  // 週ビュー
  if (viewMode === 'week') {
    return (
      <div className="w-full">
        {/* ヘッダーコントロール */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg p-3 sm:p-4 border-b border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="text-blue-600" size={18} />
              シフトカレンダー
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const targetDate = selectedDate ?? new Date()
                  setSelectedDate(targetDate)
                  setViewMode('day')
                }}
                className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors touch-manipulation"
              >
                日表示
              </button>
              <button
                onClick={handleToday}
                className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation"
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
              <ChevronLeft className="text-blue-600" size={18} />
            </button>
            <div className="text-center flex-1 px-4">
              <div className="text-xs sm:text-sm font-semibold text-slate-900">
                {format(weekStart, 'yyyy年M月d日', { locale: ja })} 〜 {format(weekEnd, 'M月d日', { locale: ja })}
              </div>
            </div>
            <button
              onClick={handleNextWeek}
              className="p-2 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors touch-manipulation"
              aria-label="次の週"
            >
              <ChevronRight className="text-blue-600" size={18} />
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
          {/* モバイル: 縦スクロール表示 */}
          <div className="space-y-2 p-2">
            {weekDays.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const eventsForDay = dayEvents.get(dayKey) || []
              const isDayToday = isToday(day)
              
              return (
                <div
                  key={dayKey}
                  className={`border-2 rounded-lg overflow-hidden ${
                    isDayToday ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* 日付ヘッダー */}
                  <div
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isDayToday ? 'bg-blue-100' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                    onClick={() => handleDateClick(day)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex flex-col items-center justify-center ${
                        isDayToday ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        <div className="text-xs font-semibold">
                          {format(day, 'E', { locale: ja })}
                        </div>
                        <div className="text-base sm:text-lg font-bold">
                          {format(day, 'd')}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm sm:text-base">
                          {formatDateFull(day)}
                        </div>
                        <div className="text-xs text-slate-600">
                          {eventsForDay.length}件のシフト
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddShift(day)
                        }}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation"
                        aria-label="シフト追加"
                      >
                        <Plus size={16} />
                      </button>
                      <ChevronRight className="text-slate-400" size={18} />
                    </div>
                  </div>

                  {/* イベントリスト */}
                  {eventsForDay.length > 0 && (
                    <div className="px-3 pb-3 space-y-2">
                      {eventsForDay.map((event) => {
                        const eventColor = (event as any).color || '#3b82f6'
                        const getTextColor = (bgColor: string) => {
                          const hex = bgColor.replace('#', '')
                          const r = parseInt(hex.substr(0, 2), 16)
                          const g = parseInt(hex.substr(2, 2), 16)
                          const b = parseInt(hex.substr(4, 2), 16)
                          const brightness = (r * 299 + g * 587 + b * 114) / 1000
                          return brightness > 128 ? '#1e293b' : '#ffffff'
                        }
                        const textColor = getTextColor(eventColor)
                        
                        return (
                          <div
                            key={event.id}
                            className="p-3 rounded-lg cursor-pointer transition-all active:scale-95 border-2 hover:shadow-md"
                            style={{
                              backgroundColor: eventColor + '20',
                              borderColor: eventColor,
                              color: textColor,
                            }}
                            onClick={() => onSelectEvent(event)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1">
                                <Clock size={16} style={{ color: eventColor }} />
                                <span className="font-bold text-sm" style={{ color: textColor }}>
                                  {formatTime(event.start)} - {formatTime(event.end)}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm font-medium" style={{ color: textColor }}>
                              {event.title}
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
      <div className="w-full">
        {/* ヘッダーコントロール */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg p-3 sm:p-4 border-b border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => {
                setViewMode('week')
                setSelectedDate(null)
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors touch-manipulation"
            >
              <ChevronLeft size={16} />
              週表示に戻る
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation"
            >
              今日
            </button>
          </div>

          <div className="text-center">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
              {formatDateFull(selectedDate)}
            </h3>
            <div className="text-xs sm:text-sm text-slate-600">
              {selectedDateEvents.length}件のシフト
            </div>
          </div>
        </div>

        {/* 日詳細ビュー */}
        <div className="bg-white rounded-b-lg p-3 sm:p-4">
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => handleAddShift(selectedDate)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation font-semibold text-sm"
            >
              <Plus size={18} />
              シフトを追加
            </button>
          </div>

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
                  className="p-4 rounded-xl border-2 border-slate-200 hover:border-blue-300 transition-all cursor-pointer active:scale-95 bg-white"
                  onClick={() => onSelectEvent(event)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50">
                        <Clock size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="font-bold text-base sm:text-lg text-slate-900">
                          {formatTime(event.start)} - {formatTime(event.end)}
                        </div>
                        <div className="text-xs sm:text-sm text-slate-600 mt-1">
                          {format(selectedDate, 'M/d(E)', { locale: ja })}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm sm:text-base font-semibold text-slate-900">
                    {event.title}
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
