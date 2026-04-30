/**
 * Nitro server task — Cloudflare Cron Trigger から自動実行される
 * nuxt.config.ts の nitro.scheduledTasks で登録済み
 * 全ユーザーの会話を分析し、気づきを生成してDBに保存する
 */

import {
  MIN_MESSAGES_FOR_INSIGHT,
  generateInsight,
  getUserMessageTexts,
  saveInsight,
  isRefreshable,
} from '~/server/utils/deepheart-insights'

export default defineTask({
  meta: {
    name: 'deepheart:insights',
    description: 'deepheartの会話履歴を分析して気づきを生成',
  },
  async run({ context }) {
    const db = (context as Record<string, unknown>)?.cloudflare?.env?.DEEPHEART_DB as any
    if (!db) throw new Error('DEEPHEART_DB バインディングが見つかりません')

    const encKey = ((context as Record<string, unknown>)?.cloudflare?.env as any)?.DEEPHEART_ENCRYPTION_KEY as string | null ?? null
    const { openaiApiKey } = useRuntimeConfig()
    if (!openaiApiKey) throw new Error('openaiApiKey が設定されていません')

    // 全ユーザーのうち、直近24時間以内にメッセージを送った人を対象にする
    const usersRes = await db
      .prepare(
        "SELECT DISTINCT user_id FROM deepheart_messages WHERE role = 'user' AND created_at > datetime('now', '-7 days')"
      )
      .all<{ user_id: string }>()

    const userIds: string[] = (usersRes.results ?? []).map((r: { user_id: string }) => r.user_id)

    let processed = 0
    let skipped = 0

    for (const userId of userIds) {
      try {
        // 直近インサイトのcreated_atを確認
        const last = await db
          .prepare('SELECT created_at FROM deepheart_insights WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
          .bind(userId)
          .first<{ created_at: string }>()

        if (last && !isRefreshable(last.created_at)) {
          skipped++
          continue
        }

        const messages = await getUserMessageTexts(db, userId, encKey)
        if (messages.length < MIN_MESSAGES_FOR_INSIGHT) {
          skipped++
          continue
        }

        const insight = await generateInsight(messages, openaiApiKey as string)
        if (!insight) {
          skipped++
          continue
        }

        await saveInsight(db, userId, insight, messages.length, encKey)
        processed++
      } catch (err) {
        console.error(`[deepheart:insights] userId=${userId} でエラー:`, err)
      }
    }

    return { result: `processed=${processed} skipped=${skipped} total=${userIds.length}` }
  },
})
