<template>
  <UiModal
    :model-value="issues.length > 0"
    title="Проблемы конфигурации"
    :width="480"
    :actions="[{ text: 'Понятно', type: 'primary', actionType: 'confirm' }]"
    :on-confirm="() => $emit('close')"
    @update:model-value="!$event && $emit('close')"
  >
    <div class="issues-root">
      <UiAlert
        v-for="issue in issues"
        :key="issue.code"
        :type="issue.severity === 'error' ? 'error' : 'warning'"
      >
        {{ issue.message }}
      </UiAlert>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { UiModal, UiAlert } from '@fastio/ui'
import type { ConfigIssue } from '@fastio/shared'

defineProps<{
  issues: ConfigIssue[]
}>()

defineEmits<{
  close: []
}>()
</script>

<style scoped lang="scss">
.issues-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
