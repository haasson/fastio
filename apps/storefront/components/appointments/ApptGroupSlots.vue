<template>
  <div class="slots-root">
    <Transition name="slot-fade" mode="out-in">
      <div v-if="loading" key="loading" class="chips-grid">
        <FsSkeleton
          v-for="n in skeletonCount"
          :key="n"
          variant="rect"
          height="40px"
          rounded
        />
      </div>

      <div
        v-else-if="result?.type === 'slots' && result.entries.length === 0"
        key="empty"
        class="empty-state"
      >
        В этот день свободных окон нет — попробуйте другую дату
      </div>

      <div
        v-else-if="result?.type === 'slots'"
        key="slots"
        class="slots-content"
      >
        <div class="chips-grid">
          <button
            v-for="entry in result.entries"
            :key="entry.startTime"
            type="button"
            class="chip"
            :class="[
              entry.match === 'preferred' ? 'chip-green' : 'chip-yellow',
              { selected: selectedEntry?.startTime === entry.startTime },
            ]"
            @click="emit('update:selectedEntry', entry)"
          >
            {{ entry.startTime }}
          </button>
        </div>

        <div v-if="selectedEntry" class="schedule-preview">
          <div class="preview-title">
            <Check :size="14" class="preview-check" />
            <span>Ваше расписание</span>
          </div>
          <div
            v-for="(entry, i) in selectedEntry.schedule"
            :key="i"
            class="schedule-row"
          >
            <div class="row-head">
              <span class="row-service">{{ serviceNames[entry.serviceId] ?? '—' }}</span>
              <span class="row-time">{{ entry.startTime }}–{{ entry.endTime }}</span>
            </div>
            <div class="row-master">
              <template v-if="entry.preferredResourceName">
                <span class="master-old">{{ entry.preferredResourceName }}</span>
                <ArrowRight :size="11" class="master-arrow" />
              </template>
              <span class="master-new" :class="{ replaced: !!entry.preferredResourceName }">
                {{ entry.resourceName }}
              </span>
            </div>
          </div>
          <FsAlert v-if="selectedEntry.match === 'any'" type="warning" class="warn-alert">
            <AlertTriangle :size="14" />
            На это время выбор по предпочтению недоступен — подобрали замену.
          </FsAlert>
        </div>
      </div>
    </Transition>

    <FsButton
      variant="primary"
      size="large"
      :disabled="!selectedEntry"
      @click="emit('confirm')"
    >
      Продолжить
    </FsButton>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, AlertTriangle, ArrowRight } from 'lucide-vue-next'
import { FsButton, FsSkeleton, FsAlert } from '@fastio/public-ui'
import type { GroupSlotsResult, GroupSlotEntry } from '@fastio/shared'

const props = defineProps<{
  result: GroupSlotsResult | null
  loading: boolean
  selectedEntry: GroupSlotEntry | null
  serviceNames: Record<string, string>
}>()

const emit = defineEmits<{
  'update:selectedEntry': [entry: GroupSlotEntry]
  confirm: []
  'request-only': []
}>()

const DEFAULT_SKELETON_COUNT = 12
const lastSlotsCount = ref<number>(DEFAULT_SKELETON_COUNT)
const skeletonCount = ref<number>(DEFAULT_SKELETON_COUNT)

watch(
  () => props.result,
  (result) => {
    if (result?.type === 'request_only') emit('request-only')
    if (result?.type === 'slots' && result.entries.length > 0) {
      lastSlotsCount.value = result.entries.length
    }
  },
  { immediate: true },
)

watch(
  () => props.loading,
  (loading) => {
    if (loading) skeletonCount.value = lastSlotsCount.value
  },
)
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.slots-root {
  @include flex-col(16px);
}

.slots-content {
  @include flex-col(16px);
}

.slot-fade-enter-active,
.slot-fade-leave-active {
  transition: opacity 0.2s ease;
}

.slot-fade-enter-from,
.slot-fade-leave-to {
  opacity: 0;
}

.empty-state {
  @include text-body-sm;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 24px 0;
}

.chips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
}

.chip {
  height: 40px;
  border-radius: 10px;
  border: 1.5px solid transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: transform 0.1s, box-shadow 0.15s;
  color: var(--color-text);

  &:active { transform: scale(0.97); }

  &.chip-green {
    background: color-mix(in srgb, var(--color-success) 18%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-success) 50%, transparent);
  }

  &.chip-yellow {
    background: color-mix(in srgb, var(--color-warning) 20%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-warning) 55%, transparent);
  }

  &.selected {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent);
  }
}

.schedule-preview {
  @include flex-col(8px);
  padding: 12px 14px;
  background: color-mix(in srgb, var(--color-text) 6%, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}

.preview-title {
  @include flex-row(6px);
  @include text-caption(600);
  color: var(--color-text);
}

.preview-check {
  color: var(--primary);
}

.schedule-row {
  @include flex-col(2px);
  padding: 6px 0;

  & + & {
    border-top: 1px solid var(--color-border);
    padding-top: 8px;
  }
}

.row-head {
  @include flex-between;
  gap: 8px;
}

.row-service {
  @include text-caption(600);
  @include truncate;
  color: var(--color-text);
  min-width: 0;
}

.row-time {
  @include text-xs(600);
  color: var(--color-text-secondary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.row-master {
  @include flex-row(6px);
  flex-wrap: wrap;
  @include text-xs;
}

.master-old {
  color: var(--color-text-muted);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--color-warning) 70%, transparent);
}

.master-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.master-new {
  color: var(--color-text-secondary);

  &.replaced {
    color: color-mix(in srgb, var(--color-warning) 70%, var(--color-text));
    font-weight: 500;
  }
}

.warn-alert {
  @include flex-row(8px);
}
</style>
