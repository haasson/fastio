<template>
  <FsDialog
    :model-value="modelValue"
    :title="title"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="modal-root">
      <div v-if="photo || description || $slots.meta" class="modal-header">
        <img
          v-if="photo"
          :src="photo"
          :alt="title"
          class="photo"
          loading="lazy"
        >
        <div class="info">
          <FsText v-if="description" variant="body-sm" color="secondary">
            {{ description }}
          </FsText>
          <slot name="meta" />
        </div>
      </div>
      <slot />
    </div>
  </FsDialog>
</template>

<script setup lang="ts">
import { FsDialog, FsText } from '@fastio/public-ui'

type Props = {
  modelValue: boolean
  title: string
  photo?: string | null
  description?: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.modal-root {
  @include flex-col(16px);
}

.modal-header {
  @include flex-col(8px);

  @include md {
    flex-direction: row;
    gap: 16px;
  }
}

.photo {
  display: none;
  object-fit: cover;
  border-radius: var(--radius-card);

  @include md {
    display: block;
    width: 160px;
    height: 160px;
    flex-shrink: 0;
  }
}

.info {
  @include flex-col(4px);
  min-width: 0;
}
</style>
