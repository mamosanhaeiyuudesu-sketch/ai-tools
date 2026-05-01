<script setup lang="ts">
interface AiTopic {
  title: string
  conclusion: string
  flow: string[]
}

defineProps<{
  selectedWord: string | null
  aiTopics: AiTopic[]
  aiLoading: boolean
}>()
</script>

<template>
  <div class="bg-white border border-[#dde2ef] rounded-[8px] shadow-[0_2px_8px_rgba(28,45,90,0.07),0_0_0_1px_rgba(28,45,90,0.04)] overflow-hidden flex flex-col md:flex-1 md:min-h-0">
    <div v-if="!selectedWord" class="flex items-center px-3.5 py-3">
      <span class="font-mono text-[10px] text-[#9aa3c0] tracking-[0.06em]">// 単語をクリックして分析</span>
    </div>
    <template v-else>
      <div class="flex items-center flex-shrink-0 bg-[#1c2d5a] text-white px-3.5 py-2.5" style="border-left: 3px solid #a5b4fc">
        <span class="font-mono text-[8.5px] tracking-[0.2em] text-[#a5b4fc] uppercase mr-3 shrink-0">Analysis</span>
        <span class="text-[12.5px] font-semibold tracking-[0.02em] truncate">「{{ selectedWord }}」の議論</span>
      </div>
      <div class="overflow-y-auto md:flex-1 md:min-h-0">
        <div v-if="aiLoading" class="flex items-center justify-center min-h-[80px]">
          <span class="w-[22px] h-[22px] rounded-full border-2 border-[#1A237E]/30 border-t-[#1A237E] animate-spin block" />
        </div>
        <div v-else class="ai-body">
          <div v-for="(topic, ti) in aiTopics" :key="ti" :class="ti > 0 ? 'mt-4 pt-4 border-t border-[#dde2ef]' : ''">
            <div class="topic-title">{{ topic.title }}</div>
            <div class="conclusion">{{ topic.conclusion }}</div>
            <div v-if="topic.flow.length" class="flow-list">
              <template v-for="(step, si) in topic.flow" :key="si">
                <div class="flow-step">
                  <span class="step-num">{{ String(si + 1).padStart(2, '0') }}</span>
                  <span>{{ step }}</span>
                </div>
                <div v-if="si < topic.flow.length - 1" class="flow-arrow">↓</div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ai-body {
  font-size: 13px;
  color: #1c2d5a;
  padding: 12px 14px;
  line-height: 1.75;
}

.topic-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
  color: #1c2d5a;
  border-left: 3px solid #3d5fc4;
  padding-left: 8px;
}

.conclusion {
  font-size: 12px;
  color: #3a4a72;
  background: #f4f6fc;
  border: 1px solid #e8ecf8;
  border-radius: 5px;
  padding: 7px 10px;
  margin-bottom: 10px;
  line-height: 1.72;
}

.flow-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.flow-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: #1c2d5a;
  background: #fff;
  border: 1px solid #dde2ef;
  border-radius: 5px;
  padding: 6px 10px;
  line-height: 1.65;
}

.step-num {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: #a5b4fc;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
  letter-spacing: 0.05em;
}

.flow-arrow {
  text-align: center;
  color: #3d5fc4;
  font-size: 14px;
  line-height: 1.4;
  opacity: 0.45;
  margin: 1px 0;
}
</style>
