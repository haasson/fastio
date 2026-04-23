<template>
  <Transition name="fab">
    <button
      v-if="visible"
      class="fab-root"
      type="button"
      @click="emit('click')"
    >
      <slot name="icon" />
      <span class="fab-count">{{ count }}</span>
      <span class="fab-label">{{ label }}</span>
      <span class="fab-price">{{ price }}</span>
    </button>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  count: number
  label: string
  price: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.fab-root {
  position: fixed;
  bottom: max(20px, env(safe-area-inset-bottom));
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

  :deep(svg) {
    flex-shrink: 0;
  }

  @include lg {
    bottom: max(32px, env(safe-area-inset-bottom));
  }
}

.fab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding-inline: 4px;
  background: var(--on-primary);
  color: var(--primary);
  border-radius: 999px;
  @include text-xs(700);
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
