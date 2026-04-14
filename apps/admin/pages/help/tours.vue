<template>
  <div class="tours-root">
    <UiCollapse layout="clean" :expanded-names="expandedCategories">
      <UiCollapseItem
        v-for="cat in categoriesWithTours"
        :key="cat.id"
        :name="cat.id"
        :title="cat.title"
      >
        <template #header-extra>
          <UiText size="tiny" color="secondary">{{ cat.tours.length }}</UiText>
        </template>

        <div class="tour-rows">
          <div
            v-for="tour in cat.tours"
            :key="tour.id"
            class="tour-row"
            @click="launchTour(tour)"
          >
            <div class="tour-row-info">
              <UiText size="small" weight="medium">{{ tour.title }}</UiText>
              <UiText size="tiny" color="secondary" class="tour-row-desc">{{ tour.description }}</UiText>
            </div>
            <UiButton size="tiny" type="text" icon="play">Запустить</UiButton>
          </div>
        </div>
      </UiCollapseItem>
    </UiCollapse>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiText, UiCollapse, UiCollapseItem } from '@fastio/ui'
import useTour from '~/composables/useTour'
import { TOURS, TOUR_CATEGORIES } from '~/tours/index'
import type { Tour } from '~/tours/index'

const categoriesWithTours = computed(() => TOUR_CATEGORIES
  .map((cat) => ({ ...cat, tours: TOURS.filter((t) => t.category === cat.id) }))
  .filter((cat) => cat.tours.length > 0),
)

const expandedCategories = TOUR_CATEGORIES.map((c) => c.id)

const { start } = useTour()

const launchTour = async (tour: Tour) => {
  const steps = tour.getSteps()

  await start(steps)
}
</script>

<style scoped lang="scss">
.tours-root {
  max-width: 560px;
}

.tour-rows {
  display: flex;
  flex-direction: column;
}

.tour-row {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-8) var(--space-4);
  border-radius: var(--radius-8);
  cursor: pointer;

  &:hover {
    background: var(--color-bg-page);
  }
}

.tour-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  gap: 1px;
}

.tour-row-desc {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
