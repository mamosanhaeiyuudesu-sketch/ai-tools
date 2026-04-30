import { encryptMessage, decryptMessage } from './deepheart'
import { callOpenAi, extractText } from './openai'

export const MIN_MESSAGES_FOR_INSIGHT = 5
export const MAX_MESSAGES_FOR_INSIGHT = 100
export const INSIGHT_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

export interface InsightResult {
  concerns: string
  emotions: string
  patterns: string
  strengths: string
  hints: string[]
  nextStep: string
}

const SYSTEM_PROMPT = `あなたは共感的なカウンセリング支援AIです。
ユーザーがカウンセリングチャットで話した発言一覧を渡します。
これを読み、以下のJSON形式で心理的パターンの分析を行ってください。

診断や判断はせず、観察された傾向をあたたかく建設的な言葉で記述してください。
強みの項目は必ず記載し、ユーザーが自分を責めすぎないよう配慮してください。
nextStepは今週中に実行できる、とても小さく具体的な行動にしてください。
返答はJSONのみを返してください（コードブロック不要）。

{
  "concerns": "繰り返し登場している悩みや状況のテーマ（2〜4文）",
  "emotions": "よく現れる感情と、それが起きやすい状況（2〜4文）",
  "patterns": "繰り返し見られる思考や行動のクセ（2〜4文）",
  "strengths": "発言から見えてくる強みやリソース（2〜3文）",
  "hints": [
    "心理的な気づきのヒント（1〜2文）",
    "心理的な気づきのヒント（1〜2文）",
    "心理的な気づきのヒント（1〜2文）"
  ],
  "nextStep": "今週中にできる、とても小さな一歩（1〜2文）"
}`

export async function generateInsight(
  userMessages: string[],
  apiKey: string
): Promise<InsightResult | null> {
  if (userMessages.length < MIN_MESSAGES_FOR_INSIGHT) return null

  const msgs = userMessages.slice(-MAX_MESSAGES_FOR_INSIGHT)
  const userText = msgs.map((m, i) => `[${i + 1}] ${m}`).join('\n')

  try {
    const data = await callOpenAi(apiKey, {
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: SYSTEM_PROMPT }] as any,
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userText }] as any,
        },
      ],
      max_output_tokens: 800,
    })

    const text = extractText(data)
    if (!text) return null

    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(clean) as Partial<InsightResult>
    if (!parsed.concerns || !Array.isArray(parsed.hints) || !parsed.nextStep) return null

    return {
      concerns: parsed.concerns,
      emotions: parsed.emotions ?? '',
      patterns: parsed.patterns ?? '',
      strengths: parsed.strengths ?? '',
      hints: parsed.hints.slice(0, 5),
      nextStep: parsed.nextStep,
    }
  } catch {
    return null
  }
}

export async function getUserMessageTexts(
  db: any,
  userId: string,
  encKey: string | null,
  limit = MAX_MESSAGES_FOR_INSIGHT
): Promise<string[]> {
  const res = await db
    .prepare(
      'SELECT content FROM deepheart_messages WHERE user_id = ? AND role = ? ORDER BY created_at DESC LIMIT ?'
    )
    .bind(userId, 'user', limit)
    .all<{ content: string }>()

  const rows = ((res.results ?? []) as { content: string }[]).reverse()
  return Promise.all(rows.map((r) => (encKey ? decryptMessage(r.content, encKey) : r.content)))
}

export async function saveInsight(
  db: any,
  userId: string,
  insight: InsightResult,
  messageCount: number,
  encKey: string | null
): Promise<{ id: string; createdAt: string }> {
  const id = crypto.randomUUID()
  const raw = JSON.stringify(insight)
  const content = encKey ? await encryptMessage(raw, encKey) : raw
  const createdAt = new Date().toISOString().replace('T', ' ').replace('Z', '')
  await db
    .prepare(
      'INSERT INTO deepheart_insights (id, user_id, content, message_count, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, userId, content, messageCount, createdAt)
    .run()
  return { id, createdAt }
}

export async function getLatestInsight(
  db: any,
  userId: string,
  encKey: string | null
): Promise<{ insight: InsightResult; createdAt: string; messageCount: number } | null> {
  const row = await db
    .prepare(
      'SELECT content, message_count, created_at FROM deepheart_insights WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    )
    .bind(userId)
    .first<{ content: string; message_count: number; created_at: string }>()

  if (!row) return null

  try {
    const raw = encKey ? await decryptMessage(row.content, encKey) : row.content
    const insight = JSON.parse(raw) as InsightResult
    return { insight, createdAt: row.created_at, messageCount: row.message_count }
  } catch {
    return null
  }
}

export function isRefreshable(createdAt: string | null): boolean {
  if (!createdAt) return true
  const ts = new Date(createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T') + 'Z').getTime()
  return Date.now() - ts > INSIGHT_REFRESH_INTERVAL_MS
}
