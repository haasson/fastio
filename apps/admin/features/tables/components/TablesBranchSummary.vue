<template>
  <div class="summary-root">
    <UiAlert type="info" icon="mapPin">
      Сводка по столам всех филиалов. Чтобы управлять столами конкретного филиала — выберите его в сайдбаре.
    </UiAlert>

    <div class="branch-grid">
      <UiCard
        v-for="branch in branchStats"
        :key="branch.id"
        size="large"
        class="branch-card"
      >
        <div class="branch-head">
          <UiIcon name="layoutGrid" :size="20" />
          <UiTitle size="h4">{{ branch.name }}</UiTitle>
        </div>

        <div class="branch-stats">
          <div class="stat">
            <UiTitle size="h3">{{ branch.total }}</UiTitle>
            <UiText size="tiny" class="stat-label">{{ pluralize(branch.total, 'стол', 'стола', 'столов') }}</UiText>
          </div>
          <div class="stat">
            <UiTitle size="h3" class="busy">{{ branch.open }}</UiTitle>
            <UiText size="tiny" class="stat-label">занято</UiText>
          </div>
          <div class="stat">
            <UiTitle size="h3" class="free">{{ branch.free }}</UiTitle>
            <UiText size="tiny" class="stat-label">свободно</UiText>
          </div>
        </div>
      </UiCard>
    </div>

    <UiEmpty
      v-if="!branches.length"
      icon="layoutGrid"
      text="Нет активных филиалов"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiText, UiTitle, UiEmpty, UiAlert } from '@fastio/ui'
import { UiIcon } from '@fastio/icons'
import { pluralize } from '@fastio/shared'
import type { Branch } from '@fastio/shared'

const props = defineProps<{
  branches: Branch[]
  tableCountByBranch: Record<string, { total: number; open: number }>
}>()

// Read-only сводка: ни кликов, ни setBranch, ни смены настроек.
// Родитель (tables.vue) монтирует/демонтирует её по смене филиала в сайдбаре.
const branchStats = computed(() => props.branches.map((branch) => {
  const counts = props.tableCountByBranch[branch.id] ?? { total: 0, open: 0 }
  const free = Math.max(0, counts.total - counts.open)

  return { id: branch.id, name: branch.name, total: counts.total, open: counts.open, free }
}))
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as mq;

.summary-root {
  @include flex-col(var(--space-16));
}

.branch-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq.mq-m {
    grid-template-columns: repeat(2, 1fr);
  }
}

.branch-card {
  @include flex-col(var(--space-16));
}

.branch-head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  color: var(--color-text-secondary);
}

.branch-stats {
  display: flex;
  gap: var(--space-24);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.stat-label {
  color: var(--color-text-hint);
}

.busy {
  color: var(--color-warning);
}

.free {
  color: var(--color-success);
}
</style>
