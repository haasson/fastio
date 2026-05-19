<template>
  <div class="step-plan-root">
    <UiTitle size="h3">Выберите тариф</UiTitle>
    <UiText size="small" class="hint">
      Начните с подходящего — сменить тариф можно в любой момент.
      Первые {{ trialDays }} {{ pluralize(trialDays, 'день', 'дня', 'дней') }} бесплатно.
    </UiText>

    <UiText v-if="configFailed" size="small" class="warning">
      Не удалось загрузить настройки биллинга — длительность пробного периода показана по умолчанию.
    </UiText>

    <div class="cards">
      <UiCard
        v-for="card in planCards"
        :key="card.key"
        size="large"
        class="card"
        :class="{ selected: modelValue === card.key }"
        @click="emit('update:modelValue', card.key)"
      >
        <div class="card-header">
          <UiTitle size="h4" class="plan-name">{{ card.name }}</UiTitle>
          <UiBadge type="default">{{ card.price > 0 ? `${formatPrice(card.price)}/мес` : 'Бесплатно' }}</UiBadge>
        </div>

        <UiText size="small" class="plan-desc">{{ card.description }}</UiText>

        <ul class="features">
          <li v-if="card.inheritedFromName" class="feature feature-inherited">
            <UiIcon name="check" :size="14" class="check-icon" />
            <UiText size="small">Всё из тарифа {{ card.inheritedFromName }}</UiText>
          </li>
          <li v-for="label in card.featureLabels" :key="label" class="feature">
            <UiIcon name="check" :size="14" class="check-icon" />
            <UiText size="small">{{ label }}</UiText>
          </li>
        </ul>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { UiTitle, UiText, UiIcon, UiBadge, UiCard } from '@fastio/ui'
import type { BusinessType } from '@fastio/shared'
import { pluralize, formatPrice } from '@fastio/shared'
import { usePlans } from '~/shared/plan/usePlans'
import { useBillingConfig } from '~/shared/plan/useBillingConfig'
import { getPlanFeatureLabels, getPrevPlanName } from '~/shared/utils/planFeatureLabels'
import { useTenantStore } from '~/shared/stores/tenant'

const props = defineProps<{
  modelValue: string | null
  businessType: BusinessType | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { plans, load: loadPlans } = usePlans()
const { trialDays, failed: configFailed, load: loadConfig } = useBillingConfig()
const tenantStore = useTenantStore()

onMounted(() => {
  // Запросы независимы — летят параллельно.
  void Promise.all([loadPlans(), loadConfig()])
})

const planCards = computed(() => {
  const bt = props.businessType ?? 'retail'

  return plans.value
    .filter((p) => p.businessType === bt)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((plan) => ({
      key: plan.key,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      featureLabels: getPlanFeatureLabels(plan, tenantStore.tenant.menuStyle),
      inheritedFromName: getPrevPlanName(plan, plans.value),
    }))
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as mq;

.step-plan-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.hint {
  color: var(--color-text-secondary);
}

.warning {
  color: var(--color-warning);
}

.cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq.mq-m {
    grid-template-columns: repeat(3, 1fr);
  }
}

.card {
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--color-primary);
  }

  &.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.plan-name {
  flex: 1;
}

.plan-desc {
  color: var(--color-text-secondary);
}

.features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  flex: 1;
}

.feature {
  display: flex;
  align-items: center;
  gap: var(--space-8);

  &-inherited {
    color: var(--color-text-secondary);

    .check-icon {
      opacity: 0.5;
    }
  }
}

.check-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}
</style>
