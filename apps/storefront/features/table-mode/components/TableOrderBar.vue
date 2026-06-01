<template>
  <Transition name="bar">
    <div v-if="hasCheck || hasDraft" class="order-bar-root" :class="{ drafting: hasDraft }">
      <div class="bar-inner">
        <!-- Чек: в покое во всю ширину, при наборе стягивается в пилюлю слева -->
        <button
          v-if="hasCheck"
          type="button"
          class="chek"
          :class="{ compact: hasDraft }"
          aria-label="Открыть счёт"
          @click="emit('open-check')"
        >
          <span class="chek-wide">
            <ReceiptText :size="18" />
            <span>Чек · {{ formatPrice(checkTotal) }}</span>
          </span>
          <span class="chek-compact">
            <span class="cap">Чек</span>
            <span class="sum">{{ formatPrice(checkTotal) }}</span>
          </span>
        </button>

        <!-- К заказу: выезжает справа когда драфт непустой -->
        <Transition name="zakaz">
          <button
            v-if="hasDraft"
            type="button"
            class="zakaz"
            @click="emit('open-draft')"
          >
            <span class="zakaz-label">К заказу</span>
            <span class="zakaz-sum">{{ draftCount }} · {{ formatPrice(draftTotal) }}</span>
          </button>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatPrice } from '@fastio/shared'
import { ReceiptText } from 'lucide-vue-next'

const props = defineProps<{
  checkCount: number
  checkTotal: number
  draftCount: number
  draftTotal: number
}>()

const emit = defineEmits<{
  'open-check': []
  'open-draft': []
}>()

const hasCheck = computed(() => props.checkCount > 0)
const hasDraft = computed(() => props.draftCount > 0)
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

$ease: cubic-bezier(0.4, 0, 0.2, 1);

.order-bar-root {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-sticky);
  padding: 8px 16px max(8px, env(safe-area-inset-bottom));
  pointer-events: none; // прозрачные поля не должны ловить тапы по меню
}

.bar-inner {
  display: flex;
  gap: 8px;
  max-width: 480px;
  margin: 0 auto;
}

// ── Чек ────────────────────────────────────────────────
.chek {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  height: 56px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-surface);
  color: var(--color-text);
  overflow: hidden;
  cursor: pointer;
  pointer-events: auto;
  transition: width 0.28s $ease, border-radius 0.28s $ease;

  &.compact {
    width: 76px;
    border-radius: 28px;
  }

  &:active {
    opacity: 0.85;
  }
}

// Два варианта контента кросс-фейдятся; «Чек» в компактном чуть всплывает вверх
.chek-wide,
.chek-compact {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.chek-wide {
  gap: 8px;
  white-space: nowrap;
  @include text-body-sm(600);
}

.chek-compact {
  flex-direction: column;
  gap: 0;
  opacity: 0;

  .cap {
    color: var(--color-text-muted);
    transform: translateY(4px);
    transition: transform 0.28s $ease;
    @include text-micro(600);
  }

  .sum {
    @include text-caption(700);
  }
}

.chek.compact {
  .chek-wide {
    opacity: 0;
  }

  .chek-compact {
    opacity: 1;
  }

  .chek-compact .cap {
    transform: translateY(0);
  }
}

// ── К заказу ───────────────────────────────────────────
.zakaz {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 56px;
  border: none;
  border-radius: 16px;
  background: var(--primary);
  color: var(--on-primary);
  cursor: pointer;
  pointer-events: auto;

  &:active {
    opacity: 0.9;
  }
}

.zakaz-label {
  @include text-body-sm(700);
}

.zakaz-sum {
  opacity: 0.9;
  @include text-caption(500);
}

// ── Переходы ───────────────────────────────────────────
.zakaz-enter-active,
.zakaz-leave-active {
  transition: opacity 0.28s ease, transform 0.28s $ease;
}

.zakaz-enter-from,
.zakaz-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.bar-enter-active,
.bar-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.bar-enter-from,
.bar-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
