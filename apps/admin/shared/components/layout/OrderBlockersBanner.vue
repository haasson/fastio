<!-- TODO: заменить на тег-индикатор в топбаре рядом с кнопкой темы:
     красный/оранжевый тег со счётчиком → дропдаун со списком проблем → модалка с деталями.
     Логика блокеров — useOrderBlockers.ts, переиспользовать как есть. -->
<template>
  <div v-if="blockers.length" class="order-blockers-banner">
    <UiIcon name="warningRound" :size="16" class="banner-icon" />
    <div class="banner-body">
      <span class="banner-title">Клиенты не могут оформить заказ:</span>
      <ul class="banner-list">
        <li v-for="blocker in blockers" :key="blocker.link" class="banner-item">
          {{ blocker.message }} —
          <NuxtLink :to="blocker.link" class="banner-link">{{ blocker.linkLabel }}</NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'
import { UiIcon } from '@fastio/ui'
import { useOrderBlockers } from '~/shared/composables/useOrderBlockers'

const { blockers } = useOrderBlockers()
</script>

<style scoped lang="scss">
.order-blockers-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-24);
  background: var(--color-error-light);
  border-bottom: 1px solid var(--color-error);
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.banner-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-error);
}

.banner-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.banner-title {
  font-weight: var(--font-weight-semibold);
}

.banner-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.banner-link {
  color: var(--color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
