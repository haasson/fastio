<template>
  <div v-if="tenant" class="billing-summary">
    <div class="summary-item">
      <UiText size="small" class="summary-label">Текущий тариф</UiText>
      <UiTitle size="h3">{{ planName }}</UiTitle>
      <UiText v-if="price > 0" size="small" class="summary-sub">
        {{ formatPrice(price) }} / мес
      </UiText>
      <UiText v-else size="small" class="summary-sub">Бесплатно</UiText>
    </div>

    <div class="summary-item">
      <UiText size="small" class="summary-label">Баланс</UiText>
      <UiTitle size="h3" :class="{ 'balance-low': (tenant.balance ?? 0) < price }">
        {{ formatPrice(tenant.balance ?? 0) }}
      </UiTitle>
    </div>

    <div v-if="price > 0 && tenant.subscription.renewsAt" class="summary-item">
      <UiText size="small" class="summary-label">Следующее списание</UiText>
      <UiTitle size="h4">{{ formatDate(tenant.subscription.renewsAt) }}</UiTitle>
      <UiText size="small" class="summary-sub">{{ formatPrice(price) }}</UiText>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { formatPrice } from '@fastio/shared'
import { UiTitle, UiText } from '@fastio/ui'
import { usePlans } from '~/composables/plan/usePlans'
import { useTenantStore } from '~/shared/stores/tenant'

const { tenant } = storeToRefs(useTenantStore())
const { plans } = usePlans()

const currentPlan = computed(() => plans.value.find((p) => p.key === tenant.value.subscription?.plan))
const planName = computed(() => currentPlan.value?.name ?? tenant.value.subscription?.plan ?? '—')
const price = computed(() => tenant.value.subscription?.priceOverride ?? currentPlan.value?.price ?? 0)

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.billing-summary {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-16);

  @include mq-m {
    grid-template-columns: repeat(3, 1fr);
  }
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.summary-label {
  color: var(--color-text-hint);
}

.summary-sub {
  color: var(--color-text-secondary);
}

.balance-low {
  color: var(--color-error);
}
</style>
