<template>
  <div v-if="show" class="past-due-banner">
    <UiIcon name="warningRound" :size="18" />
    <span>
      Оплатите подписку в течение {{ daysLeft }} {{ daysWord }}, иначе доступ будет приостановлен.
    </span>
    <UiButton
      type="text"
      size="small"
      class="banner-btn"
      @click="$router.push('/account/billing')"
    >
      Оплатить
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

const show = computed(() => tenant.value.subscription?.status === 'past_due')

const daysLeft = computed(() => {
  const sub = tenant.value.subscription

  if (!sub?.pastDueAt) return sub?.gracePeriodDays ?? 3

  const graceDays = sub.gracePeriodDays ?? 3
  const elapsed = (Date.now() - new Date(sub.pastDueAt).getTime()) / (1000 * 60 * 60 * 24)

  return Math.max(0, Math.ceil(graceDays - elapsed))
})

const daysWord = computed(() => pluralize(daysLeft.value, 'день', 'дня', 'дней'))
</script>

<style scoped lang="scss">
.past-due-banner {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-24);
  background: var(--color-warning-light);
  color: var(--color-text);
  font-size: var(--font-size-md);
  border-bottom: 1px solid var(--color-warning);
}

.banner-btn {
  margin-left: auto;
  white-space: nowrap;
}
</style>
