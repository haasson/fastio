<template>
  <div class="slot-chip-grid-root">
    <Transition name="slot-fade" mode="out-in">
      <!-- При смене даты/состава: вместо схлопывания grid'а в один Skeleton-row
           показываем СТОЛЬКО ЖЕ скелетных клеток, сколько было чипсов. Без
           этого высота секции прыгает и UI «дёргает». Паттерн взят из
           apps/storefront ApptGroupSlots. -->
      <div v-if="loading" key="loading" class="grid">
        <UiSkeleton
          v-for="n in skeletonCount"
          :key="n"
          height="40px"
        />
      </div>

      <UiAlert
        v-else-if="result?.type === 'request_only'"
        key="request"
        type="warning"
      >
        Длительность не помещается в рабочий день.
      </UiAlert>

      <UiAlert
        v-else-if="!result || (result.type === 'slots' && result.entries.length === 0)"
        key="empty"
        type="info"
      >
        {{ emptyText }}
      </UiAlert>

      <div v-else key="slots" class="grid">
        <UiChip
          v-for="entry in result.entries"
          :key="entry.startTime"
          :type="computeSlotTone(entry)"
          :selected="isSelected(entry)"
          @click="emit('click', entry)"
        >
          {{ entry.startTime }}
        </UiChip>
      </div>
    </Transition>

    <div
      v-if="result?.type === 'slots' && result.entries.length > 0 && !loading"
      class="legend"
    >
      <UiText size="tiny" class="muted">
        <span class="dot dot-green" /> предпочтительный мастер
        &nbsp;
        <span class="dot dot-yellow" /> с заменой
      </UiText>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiChip, UiAlert, UiSkeleton, UiText } from '@fastio/ui'
import type { GroupSlotEntry, GroupSlotsResult } from '@fastio/shared'
import { computeSlotTone } from '@fastio/shared'

const props = withDefaults(defineProps<{
  result: GroupSlotsResult | null
  loading: boolean
  isSelected?: (entry: GroupSlotEntry) => boolean
  emptyText?: string
}>(), {
  isSelected: () => false,
  emptyText: 'На эту дату свободных вариантов нет.',
})

const emit = defineEmits<{
  click: [entry: GroupSlotEntry]
}>()

const DEFAULT_SKELETON_COUNT = 12
const lastSlotsCount = ref<number>(DEFAULT_SKELETON_COUNT)
const skeletonCount = ref<number>(DEFAULT_SKELETON_COUNT)

watch(
  () => props.result,
  (r) => {
    if (r?.type === 'slots' && r.entries.length > 0) {
      lastSlotsCount.value = r.entries.length
    }
  },
  { immediate: true },
)

watch(
  () => props.loading,
  (l) => {
    if (l) skeletonCount.value = lastSlotsCount.value
  },
)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.slot-chip-grid-root {
  @include flex-col(var(--space-12));
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: var(--space-8);
}

.slot-fade-enter-active,
.slot-fade-leave-active {
  transition: opacity 0.15s ease;
}

.slot-fade-enter-from,
.slot-fade-leave-to {
  opacity: 0;
}

.legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.muted {
  color: var(--color-text-secondary);
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  vertical-align: middle;
  margin-right: var(--space-4);

  &.dot-green { background: var(--color-success); }
  &.dot-yellow { background: var(--color-warning); }
}
</style>
