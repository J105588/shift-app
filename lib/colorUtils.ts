/**
 * 色に関するユーティリティ関数
 */

/**
 * 16進数カラーコードをRGBに変換
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * RGBを16進数カラーコードに変換
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * 背景色に基づいて適切なテキスト色（黒または白）を決定
 */
export function getTextColor(bgColor: string): string {
  const rgb = hexToRgb(bgColor)
  if (!rgb) return '#1e293b' // デフォルトは黒

  // 相対輝度を計算（WCAG 2.0基準）
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  return brightness > 128 ? '#1e293b' : '#ffffff'
}

/**
 * 色に透明度を追加（rgba形式）
 */
export function addOpacity(color: string, opacity: number): string {
  const rgb = hexToRgb(color)
  if (!rgb) return color

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
}

/**
 * シフトの色を取得（デフォルト値付き）
 */
export function getShiftColor(shift: { color?: string | null; isGroupShift?: boolean }): string {
  if (shift.color) {
    return shift.color
  }
  // デフォルト色
  return shift.isGroupShift ? '#a855f7' : '#3b82f6'
}

