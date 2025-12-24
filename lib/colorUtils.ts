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
  // デフォルト色
  return shift.isGroupShift ? '#a855f7' : '#3b82f6'
}

/**
 * 明るい背景（または薄い色付き背景）上で読みやすいテキスト色を取得
 * ベース色が明るすぎる場合は暗くし、暗い場合はそのまま使用するか、より暗い色を返す
 */
export function getLegibleTextColor(baseColor: string): string {
  const rgb = hexToRgb(baseColor)
  if (!rgb) return '#1e293b' // デフォルトは黒

  // 相対輝度を計算
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000

  // 輝度が高い（明るい）場合、または中間的な場合、十分に暗い色にする
  // 基準値130より明るい場合は、強制的に暗い色（Slate 900相当）にする
  // これにより、黄色や薄いピンクなどの上でも読めるようになる
  // また、青などの暗い色でも、背景が薄いtintの場合はその色自体をテキストに使うと読みやすいが、
  // ここではコントラスト重視で一律暗い色にするか、あるいは元の色を少し暗くするか。

  // アプローチ: 背景が「baseColorの20% + 白」であると仮定。
  // そのため、テキストは常に暗い必要がある。

  if (brightness > 100) {
    // 元の色が明るい〜中間の場合は、確実に読める黒/濃いグレーを返す
    // 視認性を最優先
    return '#1e293b' // slate-900
  } else {
    // 元の色が十分に暗い（紺色、濃い紫など）場合は、その色自体をテキスト色として採用することで
    // 「その色のシフト」であることを表現できる
    return baseColor
  }
}

