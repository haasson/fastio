<template>
  <div class="row-root" :class="{ disabled }">
    <UiIcon v-if="draggable" name="grip" class="drag-handle" />

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
import { UiIcon } from '@fastio/icons'
import UiText from './UiText.vue'

const props = withDefaults(defineProps<{
  name?: string
  disabled?: boolean
  draggable?: boolean
  thumbUrl?: string | null
  thumbWidth?: string
  thumbHeight?: string
}>(), {
  draggable: true,
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
  gap: var(--space-12);
  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-8);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);

  &:hover { background: var(--color-bg-hover); }

  &.disabled {
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
  border-radius: var(--radius-4);
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  background: var(--color-bg-subtle);
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
  gap: var(--space-4);
}

.name {
  min-width: 0;
}

.details {
  min-width: 0;
}
</style>
