<template>
  <UiCard class="sub-card-root">
    <div class="header">
      <span class="title">{{ candidate.dishName }}</span>
      <UiTag
        size="small"
        type="warning"
        round
        icon="swap"
      >замена</UiTag>
    </div>

    <p class="notice">
      Это блюдо отменили, но в очереди есть похожее. Можно доготовить его вместо отменённого — отличия ниже.
    </p>

    <div class="compare">
      <div class="line line--was">
        <span class="label">Было</span>
        <div class="chips">
          <UiTag
            v-for="(chip, idx) in was"
            :key="`w-${idx}`"
            size="small"
            :type="chip.type"
            round
          >{{ chip.label }}</UiTag>
          <span v-if="!was.length" class="muted">обычное</span>
        </div>
      </div>
      <div class="line line--now">
        <span class="label">Стало</span>
        <div class="chips">
          <UiTag
            v-for="(chip, idx) in now"
            :key="`n-${idx}`"
            size="small"
            :type="chip.type"
            round
          >{{ chip.label }}</UiTag>
          <span v-if="!now.length" class="muted">обычное</span>
        </div>
      </div>
    </div>

    <div v-if="canCook" class="footer">
      <UiButton type="default" @click="$emit('skip')">Выбросить</UiButton>
      <UiButton type="primary" class="btn-take" @click="$emit('take')">Взять</UiButton>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KitchenQueueItem, DishDiff } from '@fastio/shared'
import { UiCard, UiTag, UiButton } from '@fastio/ui'

type Chip = { label: string; type: 'primary' | 'success' | 'error' }

const props = defineProps<{
  cancelledItem: KitchenQueueItem
  candidate: KitchenQueueItem
  diff: DishDiff
  canCook?: boolean
}>()

defineEmits<{ take: []; skip: [] }>()

// Чипы по семантике карточек кухни: `+ аддон` (primary),
// `− ингредиент` (error — убран), `ингредиент` (success — присутствует).

// Было — отличия со стороны отменённого блюда (что повар уже сделал).
const was = computed<Chip[]>(() => [
  ...props.diff.removedAddons.map((a) => ({ label: `+ ${a}`, type: 'primary' as const })),
  ...props.diff.restoredIngredients.map((i) => ({ label: `− ${i}`, type: 'error' as const })),
  ...props.diff.newlyRemovedIngredients.map((i) => ({ label: i, type: 'success' as const })),
])

// Стало — отличия со стороны кандидата (что нужно в новом блюде).
const now = computed<Chip[]>(() => [
  ...props.diff.addedAddons.map((a) => ({ label: `+ ${a}`, type: 'primary' as const })),
  ...props.diff.restoredIngredients.map((i) => ({ label: i, type: 'success' as const })),
  ...props.diff.newlyRemovedIngredients.map((i) => ({ label: `− ${i}`, type: 'error' as const })),
])
</script>

<style scoped lang="scss">
.sub-card-root {
  gap: var(--space-8);
  border: 1.5px solid var(--color-warning);
  background: var(--color-warning-light);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.title {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.compare {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.line {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
}

.label {
  flex-shrink: 0;
  width: 48px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-hint);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

// «Было» приглушаем — это прошлое состояние, акцент на «Стало».
.line--was .chips {
  opacity: 0.6;
}

.muted {
  font-size: var(--font-size-md);
  color: var(--color-text-hint);
}

.footer {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.btn-take {
  flex: 1;
}
</style>
