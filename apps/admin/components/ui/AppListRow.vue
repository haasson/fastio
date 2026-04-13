<template>
  <div class="row-root" :class="{ 'row-root--disabled': disabled }">
    <UiIcon name="grip" class="drag-handle" />

    <div v-if="thumbUrl !== undefined" class="thumb" :style="thumbStyle">
      <img
        v-if="thumbUrl"
        :src="thumbUrl"
        class="thumb-img"
        alt=""
      />
      <div v-else class="thumb-empty">
        <UiIcon name="image" :size="14" color="var(--color-text-secondary)" />
      </div>
    </div>

    <div class="content">
      <div class="name">
        <slot name="name">
          <UiText v-if="name" size="small" weight="medium">{{ name }}</UiText>
        </slot>
      </div>
      <div v-if="$slots.default" class="details">
        <slot />
      </div>
    </div>

    <slot name="append" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiIcon, UiText } from '@fastio/ui'

const props = withDefaults(defineProps<{
  name?: string
  disabled?: boolean
  thumbUrl?: string | null
  thumbWidth?: string
  thumbHeight?: string
}>(), {
  thumbWidth: '72px',
  thumbHeight: '48px',
})

const thumbStyle = computed(() => ({
  width: props.thumbWidth,
  height: props.thumbHeight,
}))
</script>

<style scoped lang="scss">
.row-root {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);

  &:hover { background: var(--color-bg-hover); }

  &--disabled {
    opacity: 0.5;
  }
}

.drag-handle {
  cursor: grab;
  color: var(--color-text-secondary);
  flex-shrink: 0;

  &:active { cursor: grabbing; }
}

.thumb {
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  min-width: 0;
}

.details {
  min-width: 0;
}
</style>
