<template>
  <Transition name="fab">
    <button
      v-if="visible"
      class="fab-root"
      type="button"
      @click="emit('click')"
    >
      <ShoppingCart :size="24" />
      <span class="fab-count">{{ cart.count }}</span>
      <span class="fab-label">Корзина</span>
      <span class="fab-price">{{ cart.subtotal }} ₽</span>
    </button>
  </Transition>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { ShoppingCart } from 'lucide-vue-next'
import { useCartStore } from '~/stores/cart'

const emit = defineEmits<{
  click: []
}>()

const cart = useCartStore()
const visible = computed(() => cart.count > 0)
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.fab-root {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-sticky, 200);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  background: var(--primary);
  color: var(--on-primary);
  border-radius: 999px;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--primary) 40%, transparent);
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  cursor: pointer;
  border: none;

  :deep(svg) {
    flex-shrink: 0;
  }

  @include lg {
    bottom: 32px;
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
  font-size: 12px;
  font-weight: 700;
}

.fab-label {
  // просто текст
}

.fab-price {
  // просто текст
}

// Анимация появления
.fab-enter-active,
.fab-leave-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-enter-from,
.fab-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px) scale(0.9);
}
</style>
