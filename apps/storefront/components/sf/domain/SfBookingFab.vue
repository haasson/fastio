<template>
  <Transition name="fab">
    <button class="fab-root" type="button" @click="emit('click')">
      <CalendarCheck :size="20" />
      <span class="fab-label">Забронировать</span>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { CalendarCheck } from 'lucide-vue-next'

const emit = defineEmits<{ click: [] }>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.fab-root {
  position: fixed;
  bottom: 20px;
  left: 0;
  right: var(--scrollbar-width, 0px);
  margin-inline: auto;
  width: fit-content;
  z-index: var(--z-sticky);
  @include flex-row(10px);
  padding: 14px 24px;
  background: var(--primary);
  color: var(--on-primary);
  border-radius: 999px;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--primary) 40%, transparent);
  @include text-body-sm(600);
  white-space: nowrap;
  cursor: pointer;
  border: none;

  @include lg {
    bottom: 32px;
  }
}

.fab-enter-active,
.fab-leave-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-enter-from,
.fab-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.9);
}
</style>
