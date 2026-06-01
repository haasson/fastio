<template>
  <div class="draft-item-root">
    <div class="item-info">
      <FsText variant="body-sm" :weight="500">{{ item.dishName }}</FsText>
      <FsText v-if="summary" variant="caption" color="secondary">{{ summary }}</FsText>
      <FsText variant="caption" color="secondary">{{ formatPrice(itemTotal) }}</FsText>
    </div>

    <div class="item-actions">
      <div class="qty-stepper">
        <button
          type="button"
          class="qty-btn"
          aria-label="Уменьшить"
          @click="emit('dec')"
        >
          <Minus :size="16" />
        </button>
        <FsText variant="body-sm" :weight="600" class="qty-value">{{ item.quantity }}</FsText>
        <button
          type="button"
          class="qty-btn"
          aria-label="Увеличить"
          @click="emit('inc')"
        >
          <Plus :size="16" />
        </button>
      </div>
      <button
        type="button"
        class="remove-btn"
        aria-label="Удалить"
        @click="emit('remove')"
      >
        <Trash2 :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FsText } from '@fastio/public-ui'
import { getItemUnitPrice, getItemSummary, formatPrice } from '@fastio/shared'
import { Minus, Plus, Trash2 } from 'lucide-vue-next'
import type { DishCartItem } from '~/features/cart'

const props = defineProps<{
  item: DishCartItem
}>()

const emit = defineEmits<{
  inc: []
  dec: []
  remove: []
}>()

const itemTotal = computed(() => getItemUnitPrice(props.item) * props.item.quantity)

const summary = computed(() => getItemSummary(props.item))
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.draft-item-root {
  @include flex-between(8px);
  align-items: center;
  padding: 10px 12px;
  background: var(--color-surface);
  border-radius: var(--radius-card);
}

.item-info {
  @include flex-col(2px);
  min-width: 0;
}

.item-actions {
  @include flex-row(8px);
  align-items: center;
  flex-shrink: 0;
}

.qty-stepper {
  @include flex-row(8px);
  align-items: center;
}

.qty-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.15s ease;

  &:active {
    background: var(--surface-hover);
  }
}

.qty-value {
  min-width: 20px;
  text-align: center;
}

.remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s ease;

  &:active {
    color: var(--color-error);
  }
}
</style>
