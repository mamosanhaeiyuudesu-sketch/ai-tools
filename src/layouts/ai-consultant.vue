<template>
  <div class="ai-consultant-layout">
    <slot />
  </div>
</template>

<style>
/* Vuetify のグローバルスタイルをリセット */
.ai-consultant-layout,
.ai-consultant-layout ~ * {
  all: initial;
}

body:has(.ai-consultant-layout) {
  background: initial !important;
  color: initial !important;
  font-family: initial !important;
}

.v-application:has(.ai-consultant-layout) {
  background: transparent !important;
}
</style>
