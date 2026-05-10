<template>
  <UiCard class="services-dashboard-root">
    <UiTitle size="h3">
      Дашборд услуг
    </UiTitle>
    <UiText>
      Скоро появится — пока используйте раздел «Запись» для просмотра расписания и историю визитов.
    </UiText>
  </UiCard>
</template>

<script setup lang="ts">
import { UiCard, UiTitle, UiText } from '@fastio/ui'
</script>

<style scoped lang="scss">
.services-dashboard-root {
  padding: var(--space-24);
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}
</style>
