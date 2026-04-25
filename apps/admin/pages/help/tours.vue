<template>
  <div class="tours-root">
    <div
      v-for="cat in categoriesWithTours"
      :key="cat.id"
      class="category"
    >
      <button class="cat-header" @click="toggle(cat.id)">
        <UiText size="small" weight="medium">{{ cat.title }}</UiText>
        <UiText size="tiny" color="secondary">{{ cat.tours.length }}</UiText>
        <UiIcon
          name="chevronRight"
          :size="14"
          class="cat-arrow"
          :class="{ open: expanded.has(cat.id) }"
        />
      </button>

      <div v-if="expanded.has(cat.id)" class="tour-rows">
        <div
          v-for="tour in cat.tours"
          :key="tour.id"
          class="tour-row"
          @click="launchTour(tour)"
        >
          <UiText size="tiny" class="tour-title">{{ tour.title }}</UiText>
          <UiButton size="tiny" @click.stop="launchTour(tour)">Запустить</UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiText } from '@fastio/ui'
import { UiIcon } from '@fastio/icons'
import useTour from '~/composables/useTour'
import { useGate } from '~/composables/plan/useGate'
import { TOURS, TOUR_CATEGORIES } from '~/tours/index'
import type { Tour } from '~/tours/index'

const gate = useGate()

const categoriesWithTours = computed(() => TOUR_CATEGORIES
  .map((cat) => ({
    ...cat,
    tours: TOURS.filter((t) => t.category === cat.id && (!t.isVisible || t.isVisible(gate))),
  }))
  .filter((cat) => cat.tours.length > 0),
)

const expanded = ref(new Set<string>())

const toggle = (id: string) => {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

const { start } = useTour()

const launchTour = async (tour: Tour) => {
  await start(tour.getSteps())
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.tours-root {
  max-width: 480px;
  display: flex;
  flex-direction: column;
}

.category {
  border-bottom: 1px solid var(--color-border-light);

  &:last-child {
    border-bottom: none;
  }
}

.cat-header {
  @include flex-row(var(--space-8));
  width: 100%;
  padding: var(--space-8) var(--space-4);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--color-bg-hover);
    border-radius: var(--radius-8);
  }

  .cat-arrow {
    margin-left: auto;
    transition: transform 0.15s ease;
    color: var(--color-text-tertiary);

    &.open {
      transform: rotate(90deg);
    }
  }
}

.tour-rows {
  display: flex;
  flex-direction: column;
  padding-bottom: var(--space-4);
  border-top: 1px solid var(--color-border-light);
}

.tour-row {
  @include flex-row(var(--space-8));
  padding: var(--space-4) var(--space-4);
  border-radius: var(--radius-8);
  cursor: pointer;

  &:hover {
    background: var(--color-bg-page);
  }

  .tour-title {
    flex: 1;
  }
}
</style>
