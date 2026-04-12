// ヒートマップセルの背景色を計算する（#EEF0FF → #1A237E）
export function heatColor(value: number, min: number, max: number) {
  const t = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)))
  const r = Math.round(0xEE + t * (0x1A - 0xEE))
  const g = Math.round(0xF0 + t * (0x23 - 0xF0))
  const b = Math.round(0xFF + t * (0x7E - 0xFF))
  return { bg: `rgb(${r},${g},${b})`, light: t < 0.45 }
}
