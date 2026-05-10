<template>
  <div class="plan-cards-root">
    <UiSectionHeader title="Тариф" />

    <UiAlert v-if="isOnTrial" type="info">
      Пробный период до {{ trialEndsFormatted }} — меняйте тариф бесплатно, списаний не будет.
    </UiAlert>

    <div class="cards">
      <UiCard
        v-for="card in planCards"
        :key="card.key"
        size="large"
        :accent="card.isCurrent"
        class="card"
      >
        <div class="card-header">
          <UiTitle size="h4" class="plan-name">{{ card.name }}</UiTitle>
          <UiBadge v-if="card.price > 0" type="default">{{ card.price }} ₽/мес</UiBadge>
          <UiBadge v-else type="default">Бесплатно</UiBadge>
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

        <UiButton
          v-if="card.isCurrent"
          type="default"
          disabled
          class="plan-btn"
        >
          Текущий тариф
        </UiButton>
        <UiPopover
          v-else-if="card.isDowngrade"
          trigger="hover"
        >
          <template #trigger>
            <UiButton type="default" disabled class="plan-btn">Перейти</UiButton>
          </template>
          Для понижения тарифа обратитесь в <RouterLink to="/help/support">поддержку</RouterLink>
        </UiPopover>
        <UiButton
          v-else
          type="primary"
          :loading="changingPlan === card.key"
          class="plan-btn"
          @click="handleChangePlan(card.key)"
        >
          Перейти на {{ card.shortName }}
        </UiButton>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { UiTitle, UiText, UiIcon, UiButton, UiCard, UiSectionHeader, UiBadge, UiPopover, UiAlert, useMessage } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import { usePlans } from '~/composables/plan/usePlans'
import { getPlanFeatureLabels, getPrevPlanName, getChangePlanConfirmText } from '~/utils/planFeatureLabels'
import { useTenantStore } from '~/shared/stores/tenant'

type PlanCard = {
  key: string
  name: string
  shortName: string
  description: string
  price: number
  featureLabels: string[]
  inheritedFromName: string | null
  isCurrent: boolean
  isDowngrade: boolean
}

const tenantStore = useTenantStore()
const { tenant, businessType } = storeToRefs(tenantStore)
const { plans, getPlanSortOrder } = usePlans()
const { error, success } = useMessage()
const { confirm } = useConfirm()

const currentPlanKey = computed(() => tenant.value.subscription?.plan ?? '')
const isOnTrial = computed(() => tenant.value.subscription?.status === 'trial')
const trialEndsFormatted = computed(() => {
  const raw = tenant.value.subscription?.trialEndsAt

  if (!raw) return ''

  return new Date(raw).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
})

const planCards = computed<PlanCard[]>(() => {
  const bt = businessType.value ?? 'retail'
  const activePlans = plans.value
    .filter((p) => p.businessType === bt)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return activePlans.map((plan) => ({
    key: plan.key,
    name: plan.name,
    shortName: plan.name,
    description: plan.description,
    price: plan.price,
    featureLabels: getPlanFeatureLabels(plan, tenant.value.menuStyle),
    inheritedFromName: getPrevPlanName(plan, plans.value),
    isCurrent: plan.key === currentPlanKey.value,
    isDowngrade: getPlanSortOrder(plan.key) < getPlanSortOrder(currentPlanKey.value),
  }))
})

const changingPlan = ref<string | null>(null)

const handleChangePlan = async (planKey: string) => {
  const card = planCards.value.find((c) => c.key === planKey)

  if (!card) return

  const ok = await confirm({
    title: `Перейти на тариф «${card.name}»?`,
    message: getChangePlanConfirmText(card.price, isOnTrial.value),
    confirmText: 'Перейти',
    cancelText: 'Отмена',
  })

  if (!ok) return

  changingPlan.value = planKey
  try {
    const result = await tenantStore.changePlan(planKey)

    success(result === 'upgraded' ? 'Тариф повышен' : 'Тариф изменён')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Не удалось сменить тариф'

    error(msg)
  } finally {
    changingPlan.value = null
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.plan-cards-root {
  @include flex-col(var(--space-16));
}

.cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: repeat(3, 1fr);
  }
}

.card {
  gap: var(--space-12);
  border: 1px solid var(--color-border);
}

.card-header {
  @include flex-row(var(--space-8));
  align-items: center;
  justify-content: space-between;
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
  @include flex-col(var(--space-8));
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

.plan-btn {
  width: 100%;
  margin-top: auto;
}
</style>
