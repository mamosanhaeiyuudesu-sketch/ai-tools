const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 現在時刻を JST として表した Date（UTC getter で JST 値を読む） */
export function nowJST(): Date {
  return new Date(Date.now() + JST_OFFSET_MS)
}

/** 今日の JST 日付文字列（YYYY-MM-DD） */
export function todayJST(): string {
  return nowJST().toISOString().slice(0, 10)
}

/** 現在の JST 年 */
export function currentYearJST(): number {
  return parseInt(nowJST().toISOString().slice(0, 4), 10)
}

/** ISO 文字列または Date を JST にシフトした Date（UTC getter で JST 値を読む） */
export function toJSTDate(iso: string | Date): Date {
  const ms = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime()
  return new Date(ms + JST_OFFSET_MS)
}
