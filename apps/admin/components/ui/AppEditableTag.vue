<template>
  <UiTag
    class="tag-root"
    :class="{ editing, inactive }"
    :style="editing && animationDelay ? { animationDelay } : {}"
    :type="inactive ? 'default' : type"
    :empty="!selected || inactive"
    round
    hoverable
    @click="!editing && emit('click')"
  >
    <UiIcon
      v-if="editing"
      name="grip"
      class="grip"
      @click.stop
    />
    <span class="label">{{ label }}</span>
    <UiCounter
      v-if="count !== undefined"
      :value="count"
      :type="inactive ? 'default' : type"
      :filled="selected && !inactive"
      size="tiny"
      class="count"
    />
    <div v-if="editing" class="actions" @click.stop>
      <UiButton
        type="text"
        size="tiny"
        icon="pencil"
        @click="emit('edit')"
      />
      <UiButton
        v-if="deletable"
        type="text"
        size="tiny"
        icon="trash"
        @click="emit('delete')"
      />
    </div>
  </UiTag>
</template>

<script setup lang="ts">
import { UiTag, UiCounter, UiButton, UiIcon } from '@fastio/ui'

defineProps<{
  label: string
  type?: 'default' | 'primary' | 'warning' | 'success' | 'error'
  selected?: boolean
  editing?: boolean
  count?: number
  animationDelay?: string
  inactive?: boolean
  deletable?: boolean
}>()

const emit = defineEmits<{
  click: []
  edit: []
  delete: []
}>()
</script>

<style scoped lang="scss">
@keyframes jiggle {
  0%, 100% { transform: rotate(-1deg); }
  50% { transform: rotate(1deg); }
}

.tag-root {
  &.editing {
    animation: jiggle 0.45s ease-in-out infinite;
    cursor: grab !important;

    &:active { cursor: grabbing !important; }
  }

  &.inactive {
    opacity: 0.55;
  }
}

.grip {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin-right: 2px;
  cursor: grab;

  &:active { cursor: grabbing; }
}

.count {
  margin-left: 6px;
}

.actions {
  display: flex;
  gap: 2px;
  margin-left: 2px;
}
</style>
