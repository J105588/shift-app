'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Settings, RefreshCw, AlertTriangle, Palette, Plus, X } from 'lucide-react'
import { forceReloadPwa } from '@/lib/pwa'

type ShiftTemplate = {
  name: string
  color: string
}

type Props = {
  userId: string | null
}

export default function AdminSettings({ userId }: Props) {
  const supabase = createClient()
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(true)
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false)
  const [isPwaUpdating, setIsPwaUpdating] = useState(false)
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [customColor, setCustomColor] = useState('#64748b')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  const [isSavingTemplates, setIsSavingTemplates] = useState(false)

  // メンテナンスモードの状態を取得
  useEffect(() => {
    const fetchMaintenanceMode = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('設定取得エラー:', error)
          return
        }

        setMaintenanceMode(data?.value === 'true')
      } catch (error) {
        console.error('設定取得エラー:', error)
      } finally {
        setIsLoadingMaintenance(false)
      }
    }

    fetchMaintenanceMode()
  }, [supabase])

  // シフトテンプレートと色の設定を取得
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoadingTemplates(true)

        // テンプレート設定を取得
        const { data: templatesData, error: templatesError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'shift_templates')
          .single()

        if (templatesError && templatesError.code !== 'PGRST116') {
          console.error('テンプレート取得エラー:', templatesError)
        }

        if (templatesData?.value) {
          try {
            const parsed = JSON.parse(templatesData.value) as ShiftTemplate[]
            setTemplates(parsed)
          } catch (e) {
            console.error('テンプレートJSON解析エラー:', e)
          }
        }

        // 自由入力のデフォルト色を取得
        const { data: customColorData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'shift_custom_color')
          .single()

        if (customColorData?.value) {
          setCustomColor(customColorData.value)
        }
      } catch (error) {
        console.error('設定取得エラー:', error)
      } finally {
        setIsLoadingTemplates(false)
      }
    }

    fetchTemplates()
  }, [supabase])

  // テンプレートを保存
  const handleSaveTemplates = async () => {
    setIsSavingTemplates(true)
    try {
      // テンプレート設定を保存
      const { error: templatesError } = await supabase
        .from('app_settings')
        .upsert({
          key: 'shift_templates',
          value: JSON.stringify(templates),
          description: 'シフトテンプレートと色の設定（JSON形式）',
          updated_by: userId,
        }, {
          onConflict: 'key'
        })

      if (templatesError) throw templatesError

      // 自由入力のデフォルト色を保存
      const { error: colorError } = await supabase
        .from('app_settings')
        .upsert({
          key: 'shift_custom_color',
          value: customColor,
          description: '自由入力シフトのデフォルト色',
          updated_by: userId,
        }, {
          onConflict: 'key'
        })

      if (colorError) throw colorError

      alert('シフトテンプレートの設定を保存しました。')
    } catch (error: any) {
      console.error('設定保存エラー:', error)
      alert(`設定の保存に失敗しました: ${error?.message || '詳細不明'}`)
    } finally {
      setIsSavingTemplates(false)
    }
  }

  // テンプレートを追加
  const handleAddTemplate = () => {
    setTemplates([...templates, { name: '', color: '#64748b' }])
  }

  // テンプレートを削除
  const handleRemoveTemplate = (index: number) => {
    if (confirm('このテンプレートを削除しますか？')) {
      setTemplates(templates.filter((_, i) => i !== index))
    }
  }

  // テンプレートを更新
  const handleUpdateTemplate = (index: number, field: 'name' | 'color', value: string) => {
    const updated = [...templates]
    updated[index] = { ...updated[index], [field]: value }
    setTemplates(updated)
  }

  // メンテナンスモードの切り替え
  const handleToggleMaintenance = async () => {
    if (!confirm('システムメンテナンスモードを切り替えますか？')) return

    setIsSavingMaintenance(true)
    try {
      const newValue = !maintenanceMode
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'maintenance_mode',
          value: String(newValue),
          description: 'システムメンテナンスモード（true/false）',
          updated_by: userId,
        }, {
          onConflict: 'key'
        })

      if (error) throw error

      setMaintenanceMode(newValue)
      alert(`メンテナンスモードを${newValue ? '有効' : '無効'}にしました。`)
    } catch (error: any) {
      console.error('設定保存エラー:', error)
      alert(`設定の保存に失敗しました: ${error?.message || '詳細不明'}`)
    } finally {
      setIsSavingMaintenance(false)
    }
  }

  // PWAアップデート
  const handlePwaUpdate = async () => {
    if (!confirm('すべての端末に最新バージョンの適用を通知します。実行しますか？')) return

    setIsPwaUpdating(true)
    try {
      const version = `${Date.now()}`
      const { error } = await supabase.from('app_updates').insert({
        version,
        triggered_by: userId || null,
      })
      if (error) throw error

      alert('すべての端末に最新バージョンの適用を通知しました。')
      await forceReloadPwa()
    } catch (error: any) {
      console.error('PWA update error:', error)
      alert(`PWAの更新に失敗しました: ${error?.message || '詳細不明'}`)
    } finally {
      setIsPwaUpdating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* システムメンテナンスモード */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-2 rounded-lg bg-orange-100 flex-shrink-0">
            <AlertTriangle className="text-orange-600" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              システムメンテナンスモード
            </h3>
            <p className="text-sm text-slate-700 mb-4">
              メンテナンスモードを有効にすると、一般ユーザー（スタッフ）はシステムにアクセスできなくなります。管理者は引き続きアクセス可能です。
            </p>

            {isLoadingMaintenance ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></span>
                読み込み中...
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={handleToggleMaintenance}
                    disabled={isSavingMaintenance}
                    className={`relative inline-flex h-7 w-12 sm:h-6 sm:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation ${maintenanceMode
                      ? 'bg-orange-600'
                      : 'bg-slate-300'
                      } ${isSavingMaintenance ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    aria-label={maintenanceMode ? 'メンテナンスモードを無効にする' : 'メンテナンスモードを有効にする'}
                  >
                    <span
                      className={`inline-block h-5 w-5 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform shadow-sm ${maintenanceMode ? 'translate-x-6 sm:translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                    {maintenanceMode ? '有効' : '無効'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isSavingMaintenance && (
                    <span className="text-sm text-slate-600 flex items-center gap-1">
                      <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
                      保存中...
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* シフトテンプレート設定 */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
            <Palette className="text-blue-600" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              シフトテンプレート設定
            </h3>
            <p className="text-sm text-slate-700 mb-4">
              シフト作成時に使用できるテンプレートと色を設定できます。テンプレートを選択すると自動的に色が適用されます。
            </p>

            {isLoadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></span>
                読み込み中...
              </div>
            ) : (
              <div className="space-y-4">
                {/* テンプレート一覧 */}
                <div className="space-y-3">
                  {templates.map((template, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        value={template.name}
                        onChange={(e) => handleUpdateTemplate(index, 'name', e.target.value)}
                        placeholder="テンプレート名"
                        className="w-full sm:flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                      />
                      <div className="flex items-center justify-between sm:justify-start gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={template.color}
                            onChange={(e) => handleUpdateTemplate(index, 'color', e.target.value)}
                            className="w-12 h-10 border-2 border-slate-200 rounded-lg cursor-pointer"
                          />
                          <div
                            className="w-10 h-10 rounded-lg border-2 border-slate-200"
                            style={{ backgroundColor: template.color }}
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveTemplate(index)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 sm:gap-0"
                          title="削除"
                        >
                          <X size={18} />
                          <span className="sm:hidden text-sm font-medium">削除</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* テンプレート追加ボタン */}
                <button
                  onClick={handleAddTemplate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <Plus size={18} />
                  テンプレートを追加
                </button>

                {/* 自由入力シフトのデフォルト色 */}
                <div className="pt-4 border-t border-slate-200">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    自由入力シフトのデフォルト色
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-12 h-10 border-2 border-slate-200 rounded-lg cursor-pointer"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border-2 border-slate-200"
                      style={{ backgroundColor: customColor }}
                    />
                    <span className="text-base text-slate-700">{customColor}</span>
                  </div>
                </div>

                {/* 保存ボタン */}
                <button
                  onClick={handleSaveTemplates}
                  disabled={isSavingTemplates}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                >
                  {isSavingTemplates ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Settings size={16} />
                      設定を保存
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PWAアップデート */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
            <RefreshCw size={18} className="text-blue-600" />
            PWAアップデート
          </h3>
          <p className="text-sm text-slate-700">
            既存のキャッシュを削除し、最新のアプリに強制更新します。インストール済み端末で不具合が出た際に実行してください。
          </p>
        </div>
        <button
          onClick={handlePwaUpdate}
          disabled={isPwaUpdating}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
        >
          {isPwaUpdating ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              実行中...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              キャッシュをリセット
            </>
          )}
        </button>
      </div>
    </div>
  )
}

