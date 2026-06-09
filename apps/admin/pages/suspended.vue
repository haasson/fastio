<template>
  <div class="suspended-root">
    <UiCard class="suspended-card">
      <div class="suspended-content">
        <UiIcon name="ban" :size="48" class="suspended-icon" />
        <UiTitle size="h2">Подписка приостановлена</UiTitle>
        <UiText size="medium" class="suspended-text">
          Доступ ограничен из-за неоплаченной подписки. Пополните баланс и активируйте тариф, чтобы продолжить работу.
        </UiText>
        <UiButton type="primary" size="large" @click="$router.push('/account/billing')">
          Перейти к оплате
        </UiButton>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { definePageMeta, useRouter } from '#imports'
import { UiCard, UiTitle, UiText, UiButton, UiIcon } from '@fastio/ui'
import { useTenantStore } from '~/shared/stores/tenant'

definePageMeta({ layout: 'default' })

// Авто-оживление: realtime-подписка на tenants (useTenant.ts) обновляет статус в
// сторе, когда владелец активирует тариф. Здесь ловим переход из suspended и
// сразу уводим на дашборд — без ручной перезагрузки. Кейс смены плана и так
// делает window.location.reload(); этот вотчер закрывает реактивацию того же плана.
const { maybeTenant } = storeToRefs(useTenantStore())
const router = useRouter()

watch(
  () => maybeTenant.value?.subscription?.status,
  (status) => {
    if (status && status !== 'suspended') router.push('/')
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.suspended-root {
  @include flex-center;
  min-height: 60vh;
}

.suspended-card {
  max-width: 520px;
  width: 100%;
}

.suspended-content {
  @include flex-col(var(--space-16));
  align-items: center;
  text-align: center;
  max-width: 480px;
  margin: 0 auto;
  padding: var(--space-20);
}

.suspended-icon {
  color: var(--color-error);
}

.suspended-text {
  color: var(--color-text-secondary);
}
</style>
