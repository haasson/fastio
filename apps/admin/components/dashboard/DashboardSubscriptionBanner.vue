<template>
  <div v-if="show" class="sub-banner" :class="bannerClass">
    <UiIcon :name="icon" :size="18" />
    <span>{{ message }}</span>
    <UiButton
      type="text"
      size="small"
      class="action-btn"
      @click="$router.push('/account/billing')"
    >
      {{ actionLabel }}
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { pluralize } from '@fastio/shared'
import { UiButton, UiIcon } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'

const { tenant } = storeToRefs(useTenantStore())

const status = computed(() => tenant.value?.subscription?.status)

const show = computed(() => ['trial', 'past_due', 'suspended'].includes(status.value ?? ''))

const bannerClass = computed(() => ({
  'banner-warning': status.value === 'past_due' || status.value === 'trial',
  'banner-error': status.value === 'suspended',
}))

const icon = computed(() => status.value === 'suspended' ? 'ban' : 'warningRound')

const trialDaysLeft = computed(() => {
  const endsAt = tenant.value?.subscription?.trialEndsAt

  if (!endsAt) return 0

  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
})

const pastDueDaysLeft = computed(() => {
  const sub = tenant.value?.subscription

  if (!sub?.pastDueAt) return sub?.gracePeriodDays ?? 3

  const graceDays = sub.gracePeriodDays ?? 3
  const elapsed = (Date.now() - new Date(sub.pastDueAt).getTime()) / (1000 * 60 * 60 * 24)

  return Math.max(0, Math.ceil(graceDays - elapsed))
})

const message = computed(() => {
  if (status.value === 'trial') {
    const d = trialDaysLeft.value

    return d > 0
      ? `Пробный период закончится через ${d} ${pluralize(d, 'день', 'дня', 'дней')}. После этого потребуется подписка.`
      : 'Пробный период истёк. Оформите подписку для продолжения работы.'
  }
  if (status.value === 'past_due') {
    const d = pastDueDaysLeft.value

    return `Оплатите подписку в течение ${d} ${pluralize(d, 'дня', 'дней', 'дней')}, иначе доступ будет приостановлен.`
  }
  if (status.value === 'suspended') {
    return 'Доступ приостановлен. Пополните баланс для возобновления работы.'
  }

  return ''
})

const actionLabel = computed(() => status.value === 'suspended' ? 'Пополнить' : 'Подробнее')
</script>

<style scoped>
.sub-banner {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-12) var(--space-20);
  border-radius: var(--radius-12);
  font-size: var(--font-size-md);
}

.banner-warning {
  background: var(--color-warning-light);
  color: var(--color-text);
  border: 1px solid var(--color-warning);
}

.banner-error {
  background: var(--color-error-light);
  color: var(--color-text);
  border: 1px solid var(--color-error);
}

.action-btn {
  margin-left: auto;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
