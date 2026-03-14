<template>
  <div class="actions-block-root" :class="`size-${size}`">
    <slot name="prepend" />
    <UiButton
      v-if="showEdit"
      type="text"
      :size="size"
      icon="pencil"
      icon-bg="color-primary"
      title="Редактировать"
      @click="$emit('edit')"
    />
    <slot />
    <UiButton
      v-if="showDelete"
      type="text"
      :size="size"
      icon="trash"
      icon-bg="color-error"
      title="Удалить"
      @click="$emit('delete')"
    />
    <slot name="append" />
  </div>
</template>

<script setup lang="ts">
import { UiButton } from '@fastio/ui'

type Props = {
  size?: 'tiny' | 'small' | 'medium' | 'large'
  showEdit?: boolean
  showDelete?: boolean
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
  showEdit: true,
  showDelete: true,
})

defineEmits<{
  edit: []
  delete: []
}>()
</script>

<style scoped lang="scss">
.actions-block-root {
  display: flex;
  align-items: center;
  gap: 4px;

  &.size-small {
    gap: 8px;
  }

  &.size-medium {
    gap: 12px;
  }

  &.size-large {
    gap: 16px;
  }
}
</style>
