<template>
  <UiCard class="onboarding-root">
    <div class="icon-wrap">
      <UiIcon name="orders" :size="32" class="icon" />
    </div>
    <UiTitle size="h4" class="title">Настройте способы приёма заказов</UiTitle>
    <UiText size="small" class="description">
      Включите хотя бы один способ — доставку, самовывоз или зал — чтобы начать принимать заказы.
    </UiText>
    <div class="actions">
      <UiButton @click="$router.push('/settings/modules')">Настроить модули</UiButton>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { UiCard, UiTitle, UiText, UiButton, UiIcon } from '@fastio/ui'
</script>

<style scoped>
.onboarding-root {
  align-items: center;
  text-align: center;
  padding: var(--space-32) var(--space-24);
  gap: var(--space-12);
}

.icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-16);
  background: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon {
  color: var(--color-primary);
}

.title {
  margin: 0;
}

.description {
  color: var(--color-text-secondary);
  max-width: 400px;
}

.actions {
  margin-top: var(--space-8);
}
</style>
