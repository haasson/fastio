<template>
  <div class="empty-root">
    <span v-if="icon" class="icon">{{ icon }}</span>
    <UiText size="small" class="text">
      <slot>{{ text }}</slot>
    </UiText>
  </div>
</template>

<script setup lang="ts">
import { UiText } from '@fastio/ui'

withDefaults(defineProps<{
  text?: string
  icon?: string
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
  font-size: 40px;
}

.text {
  color: var(--color-text-tertiary);
}
</style>
