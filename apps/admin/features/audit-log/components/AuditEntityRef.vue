<template>
  <div class="entity-ref">
    <UiText
      span
      size="tiny"
      class="name"
      :class="{ empty: !entityName }"
      data-testid="entity-name"
    >
      {{ entityName || '—' }}
    </UiText>
    <UiText
      v-if="showType"
      span
      size="tiny"
      class="type"
      data-testid="entity-type"
    >
      {{ entityTypeLabel(entityType) }}
    </UiText>
    <UiTag
      v-if="branchLabel"
      type="primary"
      size="small"
      secondary
      class="branch"
      data-testid="entity-branch"
    >
      {{ branchLabel }}
    </UiTag>
  </div>
</template>

<script setup lang="ts">
import { UiText, UiTag } from '@fastio/ui'
import { entityTypeLabel } from '../utils/audit-labels'

withDefaults(defineProps<{
  entityType: string
  entityName: string | null
  showType?: boolean
  branchLabel?: string | null
}>(), {
  showType: true,
})
</script>

<style scoped lang="scss">
.entity-ref {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

// Без обрезки: длинное имя переносится — обрезающий CSS исторически был мёртвым,
// и юзеры привыкли видеть имя целиком.
.name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-title);

  // Без имени (удалённая/безымянная запись) — приглушённый прочерк
  &.empty {
    color: var(--color-text-hint);
  }
}

.type {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
}

.branch {
  margin-top: var(--space-4);
}
</style>
