<template>
  <div class="page">
    <div class="container">
      <header class="header">
        <h1>SnapReader</h1>
        <p class="subtitle">画像を送って、数秒で要約</p>
      </header>

      <div class="uploader">
        <div class="buttons-row">
          <button class="record-button camera-button" @click="fileInput?.click()" :disabled="loading">
            <span class="button-icon">📷</span>
            <span class="button-text">画像を送る</span>
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="file-input-hidden"
            @change="onFileChange"
          />
        </div>

        <div v-if="previewUrl" class="preview">
          <img :src="previewUrl" alt="選択した画像のプレビュー" />
        </div>
      </div>

      <div v-if="previewUrl" class="actions">
        <button class="primary-button" :disabled="!imageBase64 || loading" @click="submit">
          {{ loading ? '送信中...' : '要約を依頼する' }}
        </button>
        <button class="ghost-button" :disabled="loading" @click="reset">
          リセット
        </button>
      </div>

      <div v-if="error" class="status status--error">
        <p>{{ error }}</p>
      </div>

      <div v-if="loading" class="status status--info">
        <p>画像を送信しています。少々お待ちください…</p>
      </div>

      <div v-if="summary" class="status status--success">
        <h2>要約</h2>
        <p class="summary-text">{{ summary }}</p>
      </div>

      <div v-if="transcript" class="status status--info">
        <h2>全文書き起こし</h2>
        <p class="summary-text">{{ transcript }}</p>
      </div>

      <section v-if="summary" class="chat">
        <div v-if="chatMessages.length" class="chat__log">
          <div
            v-for="(message, index) in chatMessages"
            :key="index"
            class="chat__bubble"
            :class="message.role === 'user' ? 'chat__bubble--user' : 'chat__bubble--assistant'"
          >
            <p>{{ message.content }}</p>
          </div>
        </div>
        <p v-else class="chat__empty">質問を入力すると会話が始まります。</p>
        <div class="chat__suggestions">
          <p class="chat__suggestions-title">この画像を深掘りする質問</p>
          <div v-if="suggestedQuestions.length" class="chat__suggestions-list">
            <button
              v-for="(question, index) in suggestedQuestions"
              :key="index"
              class="chat__suggestion"
              type="button"
              :disabled="chatLoading || suggestionsLoading"
              @click="onSuggestionClick(question)"
            >
              {{ question }}
            </button>
          </div>
          <p v-else class="chat__suggestions-empty">
            {{ suggestionsLoading ? '提案を生成中…' : '質問候補はありません。' }}
          </p>
          <p v-if="suggestionsError" class="chat__suggestions-status chat__suggestions-status--error">
            {{ suggestionsError }}
          </p>
        </div>
        <form class="chat__form" @submit.prevent="sendChat">
          <textarea
            v-model="chatInput"
            class="chat__input"
            placeholder="質問を入力..."
            :disabled="chatLoading"
            @keydown="onChatKeydown"
          ></textarea>
          <button class="primary-button" type="submit" :disabled="chatLoading || !chatInput.trim()">
            {{ chatLoading ? '送信中...' : '送信' }}
          </button>
        </form>
        <div v-if="chatError" class="status status--error">
          <p>{{ chatError }}</p>
        </div>
      </section>

      <div v-if="history.length > 0" class="history">
        <h2>履歴</h2>
        <div class="history-table-wrapper">
          <table class="history-table">
            <thead>
              <tr>
                <th class="col-date">日時</th>
                <th class="col-copy">コピー</th>
                <th class="col-delete">削除</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in history" :key="item.id">
                <td class="col-date">{{ formatDate(item.timestamp) }}</td>
                <td class="col-copy">
                  <button
                    @click="copyHistory(item)"
                    class="action-button"
                    :title="item.id === copiedHistoryId ? 'コピーしました!' : 'コピー'"
                  >
                    {{ item.id === copiedHistoryId ? '✓' : '📋' }}
                  </button>
                </td>
                <td class="col-delete">
                  <button @click="deleteHistory(item.id)" class="action-button delete" title="削除">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

interface HistoryItem {
  id: string
  timestamp: string
  summary: string
}

const STORAGE_KEY = 'snapreader-history'

const previewUrl = ref<string>('')
const fileInput = ref<HTMLInputElement | null>(null)
const imageBase64 = ref<string>('')
const summary = ref<string>('')
const transcript = ref<string>('')
const error = ref<string>('')
const loading = ref(false)
const chatMessages = ref<ChatMessage[]>([])
const chatInput = ref('')
const chatLoading = ref(false)
const chatError = ref('')
const includeImageInChat = ref(false)
const suggestedQuestions = ref<string[]>([])
const suggestionsLoading = ref(false)
const suggestionsError = ref('')
const history = ref<HistoryItem[]>([])
const copiedHistoryId = ref<string | null>(null)

onMounted(() => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      history.value = JSON.parse(stored)
    } catch {
      history.value = []
    }
  }
})

const saveHistory = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value))
}

const addHistory = (summaryText: string) => {
  const item: HistoryItem = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    summary: summaryText,
  }
  history.value.unshift(item)
  saveHistory()
}

const deleteHistory = (id: string) => {
  history.value = history.value.filter(item => item.id !== id)
  saveHistory()
}

const copyHistory = async (item: HistoryItem) => {
  try {
    await navigator.clipboard.writeText(item.summary)
    copiedHistoryId.value = item.id
    setTimeout(() => { copiedHistoryId.value = null }, 2000)
  } catch (err) {
    console.error('Copy failed:', err)
  }
}

const formatDate = (iso: string): string => {
  const d = new Date(iso)
  const y = String(d.getFullYear()).slice(-2)
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}/${mo}/${day} ${h}:${mi}`
}

const formatText = (text: string) => {
  const withoutBlocks = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```/g, '')
  )
  const withoutMarkdown = withoutBlocks
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/^\s*#+\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[`*_~]/g, '')
  return withoutMarkdown.replace(/。/g, '。\n').trim()
}

const normalizeQuestion = (question: string) =>
  formatText(question).replace(/\s+/g, ' ').trim()

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  error.value = ''
  summary.value = ''
  transcript.value = ''

  if (!file.type.startsWith('image/')) {
    error.value = '画像ファイルを選択してください。'
    return
  }

  try {
    const dataUrl = await toDataUrl(file)
    previewUrl.value = dataUrl
    imageBase64.value = dataUrl
  } catch (err) {
    error.value = (err as Error).message
  }
}

const updateSuggestions = async () => {
  if (!transcript.value) return

  suggestionsLoading.value = true
  suggestionsError.value = ''

  try {
    const response = await $fetch<{ questions: string[] }>('/api/snapreader/questions', {
      method: 'POST',
      body: { transcript: transcript.value },
    })
    suggestedQuestions.value = (response?.questions ?? [])
      .map((question) => normalizeQuestion(question))
      .filter(Boolean)
      .slice(0, 3)
  } catch (err: any) {
    suggestionsError.value =
      err?.data?.message || err?.statusMessage || err?.message || '質問候補の取得に失敗しました。'
  } finally {
    suggestionsLoading.value = false
  }
}

const submit = async () => {
  if (!imageBase64.value) {
    error.value = '画像を選択してください。'
    return
  }

  loading.value = true
  error.value = ''
  summary.value = ''
  chatMessages.value = []
  chatInput.value = ''
  chatError.value = ''
  suggestedQuestions.value = []
  suggestionsError.value = ''

  try {
    const transcriptResponse = await $fetch<{ transcript: string }>('/api/snapreader/transcript', {
      method: 'POST',
      body: { imageBase64: imageBase64.value },
    })
    transcript.value = formatText(transcriptResponse.transcript)

    const summaryResponse = await $fetch<{ summary: string }>('/api/snapreader/summary', {
      method: 'POST',
      body: { transcript: transcript.value },
    })
    summary.value = formatText(summaryResponse.summary)
    addHistory(summary.value)

    await updateSuggestions()
  } catch (err: any) {
    error.value =
      err?.data?.message || err?.statusMessage || err?.message || '解析に失敗しました。'
  } finally {
    loading.value = false
  }
}

const sendChat = async (overrideQuestion?: string) => {
  if (!summary.value) { chatError.value = '要約がありません。'; return }
  if (!imageBase64.value) { chatError.value = '画像を選択してください。'; return }

  const question = (overrideQuestion ?? chatInput.value).trim()
  if (!question || chatLoading.value) return

  chatLoading.value = true
  chatError.value = ''

  const nextMessages: ChatMessage[] = [
    ...chatMessages.value,
    { role: 'user', content: question },
  ]
  const trimmedMessages = nextMessages.slice(-8)
  chatMessages.value = [...nextMessages, { role: 'assistant', content: '' }]
  const assistantIndex = chatMessages.value.length - 1
  let assistantRaw = ''

  try {
    const response = await fetch('/api/snapreader/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: includeImageInChat.value ? imageBase64.value : undefined,
        summary: summary.value,
        transcript: transcript.value,
        messages: trimmedMessages,
      }),
    })

    if (!response.ok) {
      let message = '返信の取得に失敗しました。'
      try {
        const data = await response.json()
        message = data?.message || data?.statusMessage || message
      } catch {
        const text = await response.text()
        if (text) message = text
      }
      throw new Error(message)
    }

    if (!response.body) throw new Error('返信のストリームを取得できませんでした。')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) {
        assistantRaw += decoder.decode(value, { stream: true })
        chatMessages.value[assistantIndex].content = formatText(assistantRaw)
      }
    }

    assistantRaw += decoder.decode()
    chatMessages.value[assistantIndex].content = formatText(assistantRaw)
    await updateSuggestions()
  } catch (err: any) {
    chatError.value =
      err?.data?.message || err?.statusMessage || err?.message || '返信の取得に失敗しました。'
  } finally {
    chatInput.value = ''
    chatLoading.value = false
  }
}

const onChatKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter') return
  if (!(event.metaKey || event.ctrlKey)) return
  event.preventDefault()
  sendChat()
}

const onSuggestionClick = (question: string) => {
  chatInput.value = question
  sendChat(question)
}

const reset = () => {
  previewUrl.value = ''
  imageBase64.value = ''
  summary.value = ''
  transcript.value = ''
  error.value = ''
  chatMessages.value = []
  chatInput.value = ''
  chatError.value = ''
  suggestedQuestions.value = []
  suggestionsError.value = ''
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<style scoped>
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  min-height: 100vh;
}

@media (max-width: 1023px) {
  .page {
    padding: 12px 16px;
    align-items: flex-start;
    padding-top: 16px;
  }
}

.container {
  width: 100%;
  max-width: 600px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 20px 80px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  display: grid;
  gap: 16px;
}

@media (max-width: 1023px) {
  .container {
    padding: 20px;
    gap: 12px;
  }
}

.header {
  text-align: center;
  margin-bottom: 8px;
}

.header h1 {
  margin: 0;
  font-size: clamp(24px, 4vw, 32px);
  color: #f8fafc;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 16px;
}

.uploader {
  display: grid;
  gap: 12px;
}

.buttons-row {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.file-input-hidden {
  display: none;
}

.record-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid #38bdf8;
  background: rgba(56, 189, 248, 0.1);
  color: #f8fafc;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s ease;
}

@media (max-width: 1023px) {
  .record-button {
    width: 70px;
    height: 70px;
    font-size: 20px;
  }
}

.record-button:hover:not(:disabled) {
  background: rgba(56, 189, 248, 0.2);
  border-color: #0ea5e9;
  transform: scale(1.05);
}

.record-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.camera-button {
  border-color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
}

.camera-button:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.2);
  border-color: #8b5cf6;
  transform: scale(1.05);
}

.button-icon {
  display: block;
  line-height: 1;
}

.button-text {
  font-size: 10px;
  font-weight: 500;
}

.preview {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
}

.preview img {
  width: 100%;
  display: block;
  object-fit: contain;
  max-height: 360px;
}

@media (max-width: 1023px) {
  .preview img {
    max-height: 280px;
  }
}

.actions {
  display: flex;
  gap: 10px;
}

@media (max-width: 1023px) {
  .actions {
    flex-direction: column;
  }
}

.primary-button {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: #f8fafc;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.primary-button:hover:not(:disabled) {
  opacity: 0.9;
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost-button {
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.ghost-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

.ghost-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.status h2 {
  margin: 0 0 6px;
  font-size: 16px;
  color: #f8fafc;
}

.status p {
  margin: 0;
}

.summary-text {
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.6;
  color: #e2e8f0;
}

.status--success {
  background: rgba(74, 222, 128, 0.08);
  border-color: rgba(74, 222, 128, 0.3);
}

.status--error {
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.4);
  color: #fca5a5;
  font-size: 14px;
}

.status--info {
  background: rgba(125, 211, 252, 0.08);
  border-color: rgba(125, 211, 252, 0.4);
  color: #e0f2fe;
  font-size: 14px;
}

.chat {
  display: grid;
  gap: 12px;
}

.chat__log {
  display: grid;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.chat__bubble {
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.chat__bubble p {
  margin: 0;
}

.chat__bubble--user {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #e0f2fe;
}

.chat__bubble--assistant {
  background: rgba(165, 243, 252, 0.05);
  border: 1px solid rgba(125, 211, 252, 0.2);
  color: #cffafe;
}

.chat__empty {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.chat__suggestions {
  display: grid;
  gap: 8px;
}

.chat__suggestions-title {
  margin: 0;
  font-size: 14px;
  color: #cbd5e1;
}

.chat__suggestions-list {
  display: grid;
  gap: 8px;
}

.chat__suggestion {
  text-align: left;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #e0f2fe;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.2s ease;
}

.chat__suggestion:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: #7dd3fc;
}

.chat__suggestion:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.chat__suggestions-empty,
.chat__suggestions-status {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.chat__suggestions-status--error {
  color: #fca5a5;
}

.chat__form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

@media (max-width: 1023px) {
  .chat__form {
    grid-template-columns: 1fr;
  }
}

.chat__input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 12px;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 14px;
  resize: none;
  max-height: 100px;
  transition: border-color 0.2s ease;
}

.chat__input:focus {
  outline: none;
  border-color: rgba(56, 189, 248, 0.5);
}

.chat__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.history {
  margin-top: 4px;
}

.history h2 {
  margin: 0 0 12px;
  font-size: 16px;
  color: #94a3b8;
  font-weight: 500;
}

.history-table-wrapper {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.history-table-wrapper::-webkit-scrollbar {
  width: 4px;
}

.history-table-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.history-table-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.history-table thead {
  position: sticky;
  top: 0;
  background: rgba(15, 23, 42, 0.95);
  z-index: 1;
}

.history-table th {
  padding: 8px 12px;
  text-align: left;
  color: #64748b;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.history-table td {
  padding: 8px 12px;
  color: #cbd5e1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.history-table tbody tr:last-child td {
  border-bottom: none;
}

.history-table tbody tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}

.col-date {
  white-space: nowrap;
  width: 130px;
}

.col-copy,
.col-delete {
  white-space: nowrap;
  width: 48px;
  text-align: center;
}

.action-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1;
  transition: background 0.15s;
}

.action-button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.action-button.delete:hover {
  background: rgba(239, 68, 68, 0.15);
}
</style>
