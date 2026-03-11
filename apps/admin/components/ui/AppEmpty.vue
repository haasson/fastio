<template>
  <div class="empty-root">
    <UiIcon
      v-if="icon"
      :name="icon"
      :size="40"
      class="icon"
    />
    <UiText size="small" class="text">
      <slot>{{ text }}</slot>
    </UiText>
  </div>
</template>

<script setup lang="ts">
import { UiText, UiIcon } from '@fastio/ui'
import type { IconName } from '@fastio/icons'

withDefaults(defineProps<{
  text?: string
  icon?: IconName
}>(), {
  text: 'Тут пока ничего нет',
})
</script>

<style scoped lang="scss">
.empty-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 24px;
  text-align: center;
}

.icon {
  color: var(--color-text-tertiary);
}

.text {
  color: var(--color-text-tertiary);
}
</style>
