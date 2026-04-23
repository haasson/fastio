<template>
  <div class="plan-cards-root">
    <UiSectionHeader title="Тариф" />

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
import { UiTitle, UiText, UiIcon, UiButton, UiCard, UiSectionHeader, UiBadge, UiPopover, useMessage } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Plan } from '@fastio/shared'
import { getPlanTierOrder, extractPlanTier } from '@fastio/shared'
import { usePlans } from '~/composables/plan/usePlans'
import { useTenantStore } from '~/stores/tenant'

const MODULE_LABELS: Record<string, string> = {
  delivery: 'Доставка',
  pickup: 'Самовывоз',
  modifiers: 'Модификаторы',
  addons: 'Добавки',
  promotions: 'Акции и промокоды',
  combos: 'Комбо-наборы',
  kitchen: 'Экран кухни (KDS)',
  dineIn: 'QR-столы и зал',
  reservations: 'Бронирование столиков',
  services: 'Онлайн-запись',
  branches: 'Филиалы',
  customRoles: 'Кастомные роли',
  customers: 'База клиентов',
  team: 'Управление командой',
  dashboard: 'Дашборд и статистика',
}

const BASE_FEATURES: Record<string, string[]> = {
  retail: ['Конструктор сайта', 'Каталог блюд / товаров', 'Кастомный домен', 'Тема и дизайн'],
  services: ['Конструктор сайта', 'Каталог услуг', 'Кастомный домен', 'Тема и дизайн'],
}

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
const { tenant } = storeToRefs(tenantStore)
const { plans, getPlanSortOrder } = usePlans()
const { error, success } = useMessage()
const { confirm } = useConfirm()

const currentPlanKey = computed(() => tenant.value?.subscription?.plan ?? '')
const businessType = computed(() => tenant.value?.businessType ?? 'retail')

const planFeatureLabels = (plan: Plan): string[] => {
  if (extractPlanTier(plan.key) === 'showcase') {
    return BASE_FEATURES[plan.businessType] ?? BASE_FEATURES.retail
  }

  const labels: string[] = []
  const f = plan.features
  const mods = f.modules ?? {}

  for (const [key, val] of Object.entries(mods)) {
    if (val && MODULE_LABELS[key]) labels.push(MODULE_LABELS[key])
  }
  if (f.site?.telegramNotifications) labels.push('Уведомления в Telegram')
  if (f.menu?.virtualCategories) labels.push('Виртуальные категории')
  if (f.menu?.ingredients) labels.push('Состав блюд')
  if (f.resources?.max !== undefined) {
    labels.push(f.resources.max === 0 ? 'Без лимита ресурсов' : `До ${f.resources.max} активных ресурсов`)
  }

  return labels
}

const prevPlanName = (plan: Plan): string | null => {
  const order = getPlanTierOrder(plan.key)

  if (order === 0) return null
  const prev = plans.value.find(
    (p) => p.businessType === plan.businessType && getPlanTierOrder(p.key) === order - 1,
  )

  return prev?.name ?? null
}

const planCards = computed<PlanCard[]>(() => {
  const activePlans = plans.value
    .filter((p) => p.businessType === businessType.value)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return activePlans.map((plan) => ({
    key: plan.key,
    name: plan.name,
    shortName: plan.name,
    description: plan.description,
    price: plan.price,
    featureLabels: planFeatureLabels(plan),
    inheritedFromName: prevPlanName(plan),
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
    message: `Сейчас с баланса спишется ${card.price.toLocaleString('ru')} ₽, и начнётся новый оплачиваемый период на 30 дней. Неиспользованные деньги за текущий тариф не возвращаются.`,
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
