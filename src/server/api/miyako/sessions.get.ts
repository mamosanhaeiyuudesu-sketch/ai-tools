// 会期一覧を取得する
export default defineEventHandler(async (event) => {
  const { cloudflare } = event.context as any
  const db = cloudflare.env.MIYAKO_DB

  const { results } = await db
    .prepare(
      `SELECT session_id, session_type, session_name, session_date, close_date, year, term
       FROM sessions
       ORDER BY session_date DESC`
    )
    .all()

  return results as {
    session_id: string
    session_type: string
    session_name: string
    session_date: string
    close_date: string | null
    year: number
    term: number | null
  }[]
})
