import { callOpenAi, getOpenAiKey, extractText, wrapApiError } from '../../utils/openai'
import fileIds from '../../data/miyako-file-ids.json'

// "令和3年 第9回 定例会 2021-12-07〜2021-12-21" → "令和3年第9回定例会"
function normalizeKey(session: string): string {
  return session.replace(/\s/g, '').replace(/\d{4}-\d{2}-\d{2}.*/, '')
}

export default defineEventHandler(async (event) => {
  const { session, word, maxChars = 1000 } = await readBody<{ session: string; word: string; maxChars?: number }>(event)

  const apiKey = getOpenAiKey()
  const { miyakoVectorStoreId } = useRuntimeConfig()

  if (!miyakoVectorStoreId) {
    throw createError({ statusCode: 500, statusMessage: 'MIYAKO_VECTOR_STORE_ID が設定されていません。' })
  }

  const normalizedKey = normalizeKey(session)
  const fileId = (fileIds as Record<string, string>)[normalizedKey]

  if (!fileId) {
    throw createError({ statusCode: 404, statusMessage: `会期「${session}」のファイルが見つかりません。` })
  }

  try {
    const data = await callOpenAi(apiKey, {
      model: 'gpt-4.1-mini',
      input: `議事録から「${word}」に関する議論を、議会に詳しくない一般市民でも理解できるよう以下のJSON形式のみで回答してください。前置き・説明文・マークダウン記法・JSONブロック以外のテキストは一切出力しないでください。約${maxChars}文字で。

{"topics":[{"title":"議題名（具体的かつ簡潔に）","conclusion":"結論を1〜2文で簡潔に","flow":["最初の論点・発端","次の展開","最終的な到達点"]}]}

議題が複数ある場合はtopics配列に追加する。flowは議論の流れを順番に配列で表す（3〜5要素）。`,
      tools: [{
        type: 'file_search',
        vector_store_ids: [miyakoVectorStoreId],
        filters: { type: 'eq', key: 'session', value: normalizedKey },
      }],
    }, event, `miyako/search: ${normalizedKey} / ${word}`)

    const raw = extractText(data)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw createError({ statusCode: 500, statusMessage: 'AI応答のJSON解析に失敗しました。' })
    const parsed = JSON.parse(jsonMatch[0])
    return { topics: parsed.topics as { title: string; conclusion: string; flow: string[] }[] }
  } catch (e: any) {
    wrapApiError(e, '議事録の検索に失敗しました。')
  }
})
