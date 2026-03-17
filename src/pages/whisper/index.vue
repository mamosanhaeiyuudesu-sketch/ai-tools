<template>
  <div class="page">
    <div class="container">
      <header class="header">
        <div class="header-center">
          <h1>Whisper</h1>
          <p class="subtitle">音声を文字に変換</p>
        </div>
        <div class="header-actions">
          <button
            class="action-btn"
            data-label="要約"
            :disabled="filteredTexts.length === 0 || isSummarizing"
            @click="runSummary"
          >
            <span>📝</span>
            <span class="action-label">要約</span>
          </button>
          <button class="action-btn" data-label="設定" @click="settingsOpen = true">
            <span>⚙️</span>
            <span class="action-label">設定</span>
          </button>
        </div>
      </header>

      <div class="recorder">
        <div class="buttons-row">
          <!-- 録音中: 一時停止ボタンのみ -->
          <template v-if="isRecording">
            <button class="record-button recording" @click="pauseRecording">
              <span class="button-icon">⏸️</span>
              <span class="button-text">一時停止</span>
            </button>
          </template>

          <!-- 一時停止中: 再開 + 文字起こし -->
          <template v-else-if="isPaused">
            <div class="split-button">
              <button class="split-half resume-half" @click="resumeRecording">
                <span class="button-icon">▶</span>
                <span class="button-text">再開</span>
              </button>
              <div class="split-divider" />
              <button class="split-half transcribe-half" @click="transcribeRecording">
                <span class="button-icon">✍️</span>
                <span class="button-text">文字起こし</span>
              </button>
            </div>
          </template>

          <!-- 解析中 -->
          <template v-else-if="isProcessing || isUploading">
            <button class="record-button" disabled>
              <span class="button-icon">⏳</span>
              <span class="button-text">解析中</span>
            </button>
          </template>

          <!-- 初期状態: 録音 + ファイル -->
          <template v-else>
            <button class="record-button" @click="startRecording">
              <span class="button-icon">🎙️</span>
              <span class="button-text">録音</span>
            </button>

            <button class="record-button upload-button" @click="triggerUpload">
              <span class="button-icon">📂</span>
              <span class="button-text">音声ファイル</span>
            </button>
          </template>

          <input
            ref="fileInput"
            type="file"
            accept="audio/*,video/*"
            class="file-input-hidden"
            @change="onFileSelected"
          />
        </div>

        <div v-if="isRecording || duration > 0" class="timer">
          {{ formatTime(duration) }}
        </div>
      </div>

      <div v-if="error" class="error">
        <p>{{ error }}</p>
        <button class="reset-button" @click="error = ''">閉じる</button>
      </div>

      <HistoryTable :history="history" :copiedId="copiedHistoryId" @copy="copyHistory" @delete="deleteHistory" />
    </div>

    <!-- 設定モーダル -->
    <div v-if="settingsOpen" class="modal-overlay" @click.self="settingsOpen = false">
      <div class="modal">
        <div class="modal-header">
          <h2>設定</h2>
          <button class="modal-close" @click="settingsOpen = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>要約する期間</label>
            <select v-model="settings.period" class="select">
              <option value="all">すべて</option>
              <option value="today">今日</option>
              <option value="week">過去7日</option>
              <option value="month">過去30日</option>
            </select>
          </div>
          <div class="field">
            <label>システムプロンプト</label>
            <textarea
              v-model="settings.systemPrompt"
              class="textarea"
              rows="4"
              placeholder="要約してください"
            />
          </div>
          <div class="field">
            <label>OpenAI Vector Store ID <span class="optional">（任意）</span></label>
            <input
              v-model="settings.vectorStoreId"
              class="input"
              type="text"
              placeholder="vs_xxxxxxxxxx"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" @click="saveSettings">保存</button>
        </div>
      </div>
    </div>

    <!-- 要約結果モーダル -->
    <div v-if="summaryOpen" class="modal-overlay" @click.self="summaryOpen = false">
      <div class="modal modal-large">
        <div class="modal-header">
          <h2>要約結果</h2>
          <button class="modal-close" @click="summaryOpen = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="isSummarizing" class="summary-loading">
            <span class="spinner" />
            <span>要約中...</span>
          </div>
          <div v-else class="summary-text">{{ summaryResult }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="copySummary">{{ summaryCopied ? 'コピーしました' : 'コピー' }}</button>
          <button class="btn-primary" @click="summaryOpen = false">閉じる</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useHistory } from '~/composables/useHistory'

const isRecording = ref(false)
const isPaused = ref(false)
const isProcessing = ref(false)
const isUploading = ref(false)
const isSummarizing = ref(false)
const duration = ref(0)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const settingsOpen = ref(false)
const summaryOpen = ref(false)
const summaryResult = ref('')
const summaryCopied = ref(false)

const { history, copiedHistoryId, addHistory, deleteHistory, copyHistory } = useHistory('whisper-history')

// --- 設定 ---
const defaultSettings = { period: 'all', systemPrompt: '要約してください', vectorStoreId: '' }
const settings = ref({ ...defaultSettings })

onMounted(() => {
  const stored = localStorage.getItem('whisper-summary-settings')
  if (stored) {
    try { settings.value = { ...defaultSettings, ...JSON.parse(stored) } } catch {}
  }
})

const saveSettings = () => {
  localStorage.setItem('whisper-summary-settings', JSON.stringify(settings.value))
  settingsOpen.value = false
}

// --- 要約対象テキスト ---
const filteredTexts = computed(() => {
  const now = new Date()
  return history.value
    .filter((item) => {
      if (settings.value.period === 'all') return true
      const d = new Date(item.timestamp)
      if (settings.value.period === 'today') return d.toDateString() === now.toDateString()
      if (settings.value.period === 'week') return now.getTime() - d.getTime() <= 7 * 24 * 60 * 60 * 1000
      if (settings.value.period === 'month') return now.getTime() - d.getTime() <= 30 * 24 * 60 * 60 * 1000
      return true
    })
    .map((item) => item.text)
})

const runSummary = async () => {
  if (!filteredTexts.value.length) return
  summaryResult.value = ''
  summaryOpen.value = true
  isSummarizing.value = true
  try {
    const res = await $fetch<{ summary: string }>('/api/whisper/summarize', {
      method: 'POST',
      body: {
        texts: filteredTexts.value,
        systemPrompt: settings.value.systemPrompt || '要約してください',
        vectorStoreId: settings.value.vectorStoreId || undefined,
      },
    })
    summaryResult.value = res.summary
  } catch (err) {
    summaryResult.value = err instanceof Error ? err.message : '要約に失敗しました'
  } finally {
    isSummarizing.value = false
  }
}

const copySummary = async () => {
  await navigator.clipboard.writeText(summaryResult.value)
  summaryCopied.value = true
  setTimeout(() => { summaryCopied.value = false }, 2000)
}

// --- 録音 ---
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let timerInterval: ReturnType<typeof setInterval> | null = null

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const fetchTitle = async (text: string): Promise<string> => {
  try {
    const response = await $fetch<{ title: string }>('/api/snapreader/title', {
      method: 'POST',
      body: { transcript: text },
    })
    return response.title
  } catch {
    return ''
  }
}

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    audioChunks = []
    mediaRecorder.ondataavailable = (event) => { audioChunks.push(event.data) }
    mediaRecorder.start()
    isRecording.value = true
    isPaused.value = false
    duration.value = 0
    timerInterval = setInterval(() => { duration.value++ }, 1000)
  } catch (err) {
    error.value = 'マイクへのアクセスが許可されていません'
    console.error('Recording error:', err)
  }
}

const pauseRecording = () => {
  if (!mediaRecorder) return
  mediaRecorder.pause()
  isRecording.value = false
  isPaused.value = true
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
}

const resumeRecording = () => {
  if (!mediaRecorder) return
  mediaRecorder.resume()
  isRecording.value = true
  isPaused.value = false
  timerInterval = setInterval(() => { duration.value++ }, 1000)
}

const transcribeRecording = () => {
  if (!mediaRecorder) return
  mediaRecorder.stop()
  isPaused.value = false
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
    isProcessing.value = true
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      const response = await fetch('/api/whisper', { method: 'POST', body: formData })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '文字起こしに失敗しました')
      }
      const data = await response.json()
      const title = await fetchTitle(data.text)
      addHistory(data.text, title)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '予期しないエラーが発生しました'
      console.error('Transcription error:', err)
    } finally {
      isProcessing.value = false
      duration.value = 0
      mediaRecorder!.stream.getTracks().forEach(track => track.stop())
    }
  }
}

const triggerUpload = () => { fileInput.value?.click() }

const onFileSelected = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  ;(event.target as HTMLInputElement).value = ''

  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('audio', file, file.name)
    const response = await fetch('/api/whisper', { method: 'POST', body: formData })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || '文字起こしに失敗しました')
    }
    const data = await response.json()
    const title = await fetchTitle(data.text)
    addHistory(data.text, title)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '予期しないエラーが発生しました'
    console.error('Upload transcription error:', err)
  } finally {
    isUploading.value = false
  }
}
</script>

<style scoped>
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  min-height: 100%;
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
  margin-left: 10px;
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

/* ヘッダー */
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.header-center {
  flex: 1;
  text-align: center;
  padding: 0 0 0 40px;
}

.header-center h1 {
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

.header-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
  padding-top: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
  color: #f8fafc;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 1023px) {
  .action-label {
    display: none;
  }

  .action-btn {
    position: relative;
    padding: 8px 10px;
  }

  .action-btn::after {
    content: attr(data-label);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #334155;
    color: #f1f5f9;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
  }

  .action-btn:hover::after {
    opacity: 1;
  }
}

/* 録音UI */
.recorder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.buttons-row {
  display: flex;
  gap: 16px;
  align-items: center;
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

.record-button.recording {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.record-button.recording:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: #dc2626;
}

.upload-button {
  border-color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
}

.upload-button:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.2);
  border-color: #8b5cf6;
  transform: scale(1.05);
}

.record-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-icon {
  display: block;
  line-height: 1;
}

.button-text {
  font-size: 10px;
  font-weight: 500;
}

.split-button {
  display: flex;
  border-radius: 50px;
  overflow: hidden;
  border: 2px solid #38bdf8;
  height: 80px;
}

.split-half {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 80px;
  background: none;
  border: none;
  color: #f8fafc;
  cursor: pointer;
  transition: background 0.2s;
  padding: 0;
}

.split-half .button-icon {
  font-size: 20px;
}

.split-half .button-text {
  font-size: 10px;
  font-weight: 500;
}

.resume-half {
  background: rgba(56, 189, 248, 0.1);
}

.resume-half:hover {
  background: rgba(56, 189, 248, 0.25);
}

.split-divider {
  width: 1px;
  background: rgba(56, 189, 248, 0.4);
  align-self: stretch;
}

.transcribe-half {
  background: rgba(74, 222, 128, 0.1);
}

.transcribe-half:hover:not(:disabled) {
  background: rgba(74, 222, 128, 0.25);
}

.transcribe-half:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.timer {
  font-size: 20px;
  color: #ef4444;
  font-family: 'Monaco', monospace;
  font-weight: 600;
}

.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 16px;
  padding: 16px;
}

.error p {
  margin: 0 0 12px;
  color: #fca5a5;
  font-size: 14px;
}

.reset-button {
  width: 100%;
  padding: 12px 24px;
  border: none;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: #f8fafc;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.reset-button:hover {
  opacity: 0.9;
}

/* モーダル */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 100;
}

.modal {
  width: 100%;
  max-width: 480px;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.modal-large {
  max-width: 600px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: #f1f5f9;
}

.modal-close {
  background: none;
  border: none;
  color: #64748b;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 0.2s;
}

.modal-close:hover {
  color: #f1f5f9;
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
}

.optional {
  font-weight: 400;
  color: #64748b;
}

.select,
.input,
.textarea {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 14px;
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.select:focus,
.input:focus,
.textarea:focus {
  border-color: #38bdf8;
}

.textarea {
  resize: vertical;
  line-height: 1.5;
}

.select option {
  background: #1e293b;
}

.btn-primary {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: #f8fafc;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-ghost {
  padding: 8px 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #f1f5f9;
}

.summary-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px 0;
  color: #94a3b8;
  font-size: 14px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(56, 189, 248, 0.3);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.summary-text {
  color: #e2e8f0;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
