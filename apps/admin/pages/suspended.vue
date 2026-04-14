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
import { definePageMeta } from '#imports'
import { UiCard, UiTitle, UiText, UiButton, UiIcon } from '@fastio/ui'

definePageMeta({ layout: 'default' })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.suspended-root {
  @include flex-center;
  min-height: 60vh;
}

.suspended-content {
  @include flex-col(var(--space-16));
  align-items: center;
  text-align: center;
  max-width: 480px;
  padding: var(--space-20);
}

.suspended-icon {
  color: var(--color-error);
}

.suspended-text {
  color: var(--color-text-secondary);
}
</style>
