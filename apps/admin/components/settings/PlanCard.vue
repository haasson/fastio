<template>
  <UiCard class="plan-card" :class="{ current: isCurrent, available: canAfford && !isCurrent, unavailable: !canAfford && !isCurrent }">
    <div class="plan-header">
      <UiTitle size="h4">{{ plan.name }}</UiTitle>
      <UiTag v-if="isCurrent" type="success" size="small">Текущий</UiTag>
    </div>

    <UiText size="small" class="plan-description">{{ plan.description }}</UiText>

    <div class="plan-price">
      <template v-if="plan.price > 0">
        <span class="price-value">{{ formatPrice(plan.price) }}</span>
        <UiText size="tiny" class="price-period">/ мес</UiText>
      </template>
      <span v-else class="price-value">Бесплатно</span>
    </div>

    <UiButton
      v-if="!isCurrent"
      :type="canAfford ? 'primary' : 'default'"
      :disabled="!canAfford || loading"
      :loading="loading"
      size="small"
      @click="$emit('select')"
    >
      {{ canAfford ? 'Выбрать' : 'Недостаточно средств' }}
    </UiButton>
  </UiCard>
</template>

<script setup lang="ts">
import type { Plan } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import { UiCard, UiTitle, UiText, UiTag, UiButton } from '@fastio/ui'

defineProps<{
  plan: Plan
  isCurrent: boolean
  canAfford: boolean
  loading: boolean
}>()

defineEmits<{ select: [] }>()
</script>

<style scoped lang="scss">
.plan-card {
  &.current {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  &.available:hover {
    border-color: var(--color-primary);
  }

  &.unavailable {
    opacity: 0.6;
  }
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plan-description {
  color: var(--color-text-secondary);
  margin-top: 8px;
}

.plan-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 12px;
}

.price-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
}

.price-period {
  color: var(--color-text-hint);
}
</style>
