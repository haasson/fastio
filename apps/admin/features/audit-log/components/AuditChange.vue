<template>
  <div class="change" data-testid="change">
    <template v-if="change.kind === 'phrase'">
      <UiText
        span
        size="tiny"
        class="label phrase"
        data-testid="change-label"
      >{{ change.label }}</UiText>
    </template>
    <template v-else-if="change.kind === 'complex'">
      <UiText
        span
        size="tiny"
        class="label"
        data-testid="change-label"
      >{{ change.label }}</UiText>
      <div class="values">
        <UiText
          span
          size="tiny"
          class="note"
          data-testid="change-note"
        >изменено</UiText>
      </div>
    </template>
    <template v-else>
      <UiText
        span
        size="tiny"
        class="label"
        data-testid="change-label"
      >{{ change.label }}</UiText>
      <div class="values">
        <UiText
          span
          size="tiny"
          class="old"
          data-testid="change-old"
        >{{ change.oldValue }}</UiText>
        <UiText span size="tiny" class="arrow">→</UiText>
        <UiText
          span
          size="tiny"
          class="new"
          :class="directionClass"
          data-testid="change-new"
        >
          {{ change.newValue }}
        </UiText>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiText } from '@fastio/ui'
import type { RenderedChange } from '../utils/audit-labels'

const props = defineProps<{
  change: RenderedChange
}>()

// Направление красит только цену: текстовые old→new не должны
// получать красный/зелёный даже если direction вдруг заполнен.
const directionClass = computed(() => props.change.kind === 'price' ? props.change.direction : null)
</script>

<style scoped lang="scss">
// Без обрезки: длинные дельты переносятся естественно,
// ширину строки ограничивает max-width стека в ячейке.
// Дельта двухэтажная: лейбл поля сверху (hint), значения old → new — отдельной
// строкой под ним (.values — блочный контейнер, переносит спаны вниз). Двоеточие
// после лейбла убрано: на отдельной строке оно не нужно.
.change {
  font-size: var(--font-size-sm);
}

// Перебиваем responsive-размеры UiText: в ячейке журнала размер фиксированный
.label,
.old,
.arrow,
.new,
.note {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
}

.old,
.arrow {
  margin-right: var(--space-4);
}

.old {
  text-decoration: line-through;
}

// Фраза — единственный контент строки (сводка заказа, «Стол открыт»),
// не префикс-лейбл: приглушать её нельзя, это основной контент по иерархии.
.phrase {
  color: var(--color-text);
}

.new {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);

  &.up {
    color: var(--red-500);
  }

  &.down {
    color: var(--green-500);
  }
}
</style>
