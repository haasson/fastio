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

<style scoped>
.suspended-root {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.suspended-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  max-width: 480px;
  padding: 20px;
}

.suspended-icon {
  color: var(--color-error);
}

.suspended-text {
  color: var(--color-text-secondary);
}
</style>
