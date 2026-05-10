<template>
  <UiModal
    :model-value="issues.length > 0"
    :title="canProceed ? 'Внимание' : 'Нельзя отключить модуль'"
    :width="480"
    :actions="actions"
    :on-confirm="() => $emit('confirm')"
    :on-decline="() => $emit('close')"
    @update:model-value="!$event && $emit('close')"
  >
    <div class="issues-root">
      <UiAlert
        v-for="(issue, i) in issues"
        :key="i"
        :type="issue.severity === 'blocker' ? 'error' : 'warning'"
      >
        {{ issue.message }}
      </UiAlert>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiModal, UiAlert } from '@fastio/ui'
import type { ToggleIssue } from '~/shared/utils/moduleToggleChecks'

const props = defineProps<{
  issues: ToggleIssue[]
  canProceed: boolean
}>()

defineEmits<{
  confirm: []
  close: []
}>()

const actions = computed(() => {
  if (props.canProceed) {
    return [
      { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
      { text: 'Всё равно отключить', type: 'warning' as const, actionType: 'confirm' as const },
    ]
  }

  return [
    { text: 'Понятно', type: 'primary' as const, actionType: 'decline' as const },
  ]
})
</script>

<style scoped lang="scss">
.issues-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}
</style>
