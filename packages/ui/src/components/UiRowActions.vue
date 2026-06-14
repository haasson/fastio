<template>
  <div class="actions-block-root" :class="`size-${size}`">
    <slot name="prepend" />
    <UiButton
      v-if="showEdit"
      type="text"
      :size="size"
      icon="pencil"
      :icon-bg="disableEdit ? 'color-text-secondary' : 'color-primary'"
      :disabled="disableEdit"
      :title="editTitle ?? 'Редактировать'"
      @click="$emit('edit')"
    />
    <UiButton
      v-if="showCopy"
      type="text"
      :size="size"
      icon="copy"
      icon-bg="color-text-secondary"
      title="Копировать"
      @click="$emit('copy')"
    />
    <slot />
    <UiButton
      v-if="showDelete"
      type="text"
      :size="size"
      icon="trash"
      :icon-bg="disableDelete ? 'color-text-secondary' : 'color-error'"
      :disabled="disableDelete"
      :title="deleteTitle ?? 'Удалить'"
      @click="$emit('delete')"
    />
    <slot name="append" />
  </div>
</template>

<script setup lang="ts">
import UiButton from './UiButton.vue'

type Props = {
  size?: 'tiny' | 'small' | 'medium' | 'large'
  showEdit?: boolean
  disableEdit?: boolean
  showCopy?: boolean
  showDelete?: boolean
  disableDelete?: boolean
  // Кастомные тултипы (напр. причина блокировки: «Уже готовится»).
  editTitle?: string
  deleteTitle?: string
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
  showEdit: true,
  disableEdit: false,
  showCopy: false,
  showDelete: true,
  disableDelete: false,
})

defineEmits<{
  edit: []
  copy: []
  delete: []
}>()
</script>

<style scoped lang="scss">
.actions-block-root {
  display: flex;
  align-items: center;
  gap: var(--space-4);

  &.size-small {
    gap: var(--space-8);
  }

  &.size-medium {
    gap: var(--space-12);
  }

  &.size-large {
    gap: var(--space-16);
  }
}
</style>
