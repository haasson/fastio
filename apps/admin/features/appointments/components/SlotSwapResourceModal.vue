<template>
  <UiModal
    v-model="open"
    :title="title"
    :width="420"
    :on-confirm="handleConfirm"
    :actions="[
      { text: 'Отмена', actionType: 'decline' },
      { text: 'Применить', actionType: 'confirm', type: 'primary', disabled: !selectedResourceId },
    ]"
  >
    <div class="root">
      <UiText size="small" class="muted">{{ description }}</UiText>

      <UiRadioGroup
        v-if="resourceOptions.length"
        v-model="selectedResourceId"
        :options="resourceOptions"
        vertical
      />
      <UiText v-else size="small" class="muted">
        В этот слот никто не свободен. Выберите другое время.
      </UiText>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiText, UiRadioGroup } from '@fastio/ui'

const props = defineProps<{
  startTime: string
  endTime: string
  resourceOptions: Array<{ label: string; value: string }>
  // Если задан — клиент явно выбирал этого мастера. Если null — клиент
  // согласился на любого, и текст в модалке другой.
  preferredResourceId: string | null
}>()

const emit = defineEmits<{
  apply: [resourceId: string]
}>()

const open = defineModel<boolean>({ required: true })

const selectedResourceId = ref<string | null>(null)

const slotRange = computed(() => `${props.startTime}–${props.endTime}`)

const title = computed(() => props.preferredResourceId
  ? 'Выбрать другого мастера'
  : 'Назначить мастера')

const description = computed(() => props.preferredResourceId
  ? `Предпочтительный мастер занят на ${slotRange.value}. Выберите, кому отдать этот слот.`
  : `Слот ${slotRange.value} свободен у нескольких мастеров. Выберите, кого назначить.`)

watch(open, (v) => {
  if (v) selectedResourceId.value = null
})

const handleConfirm = (): boolean | void => {
  if (!selectedResourceId.value) return false
  emit('apply', selectedResourceId.value)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.root {
  @include flex-col(var(--space-12));
}

.muted {
  color: var(--color-text-secondary);
}
</style>
