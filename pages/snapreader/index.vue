<template>
  <div class="page">
    <div class="container">
      <header class="header">
        <h1>SnapReader</h1>
        <p class="subtitle">画像を送って、文字起こし</p>
      </header>

      <div class="uploader">
        <div class="buttons-row">
          <button class="record-button camera-button" @click="fileInput?.click()" :disabled="loading">
            <span class="button-icon">{{ loading ? '⏳' : '📷' }}</span>
            <span class="button-text">{{ loading ? '解析中' : '画像を送る' }}</span>
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="file-input-hidden"
            @change="onFileChange"
          />
        </div>
      </div>

      <div v-if="error" class="status status--error">
        <p>{{ error }}</p>
      </div>

      <div v-if="history.length > 0" class="history">
        <h2>履歴</h2>
        <div class="history-table-wrapper">
          <table class="history-table">
            <thead>
              <tr>
                <th class="col-date">日時</th>
                <th class="col-title">タイトル</th>
                <th class="col-copy">コピー</th>
                <th class="col-delete">削除</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in history" :key="item.id">
                <td class="col-date">{{ formatDate(item.timestamp) }}</td>
                <td class="col-title">{{ item.title }}</td>
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

interface HistoryItem {
  id: string
  timestamp: string
  transcript: string
  title: string
}

const STORAGE_KEY = 'snapreader-history'

const fileInput = ref<HTMLInputElement | null>(null)
const imageBase64 = ref<string>('')
const error = ref<string>('')
const loading = ref(false)
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

const addHistory = (transcriptText: string, titleText: string) => {
  const item: HistoryItem = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    transcript: transcriptText,
    title: titleText,
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
    await navigator.clipboard.writeText(item.transcript)
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

  if (!file.type.startsWith('image/')) {
    error.value = '画像ファイルを選択してください。'
    return
  }

  try {
    const dataUrl = await toDataUrl(file)
    imageBase64.value = dataUrl
  } catch (err) {
    error.value = (err as Error).message
    return
  }

  loading.value = true
  try {
    const transcriptResponse = await $fetch<{ transcript: string }>('/api/snapreader/transcript', {
      method: 'POST',
      body: { imageBase64: imageBase64.value },
    })
    const text = formatText(transcriptResponse.transcript)
    const titleResponse = await $fetch<{ title: string }>('/api/snapreader/title', {
      method: 'POST',
      body: { transcript: text },
    })
    addHistory(text, titleResponse.title)
  } catch (err: any) {
    error.value =
      err?.data?.message || err?.statusMessage || err?.message || '解析に失敗しました。'
  } finally {
    loading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
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


.status {
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.status p {
  margin: 0;
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

.col-title {
  color: #e2e8f0;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
