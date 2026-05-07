<template>
  <div
    class="grid-root"
    :style="rootCssVars"
  >
    <div ref="scrollRef" class="grid-scroll">
      <div class="grid-header">
        <div class="time-col-header" />
        <div
          v-for="resource in resources"
          :key="resource.id"
          class="resource-col-header"
        >
          <UiText weight="medium">{{ resource.name }}</UiText>
          <UiText size="small" class="resource-type">
            {{ resource.type === 'person' ? (resourceLabel || 'Специалист') : 'Объект' }}
          </UiText>
        </div>
      </div>

      <div class="grid-content">
        <div class="time-col">
          <div
            v-for="tick in hourTicks"
            :key="tick.minutes"
            class="time-tick"
            :style="{ top: `${tick.top}px` }"
          >
            <UiText size="small" class="time-label">{{ tick.label }}</UiText>
          </div>

          <div
            v-if="nowTop !== null"
            class="now-marker"
            :style="{ top: `${nowTop}px` }"
          />
        </div>

        <div class="resources-canvas">
          <div
            v-for="col in columnsModel"
            :key="col.resource.id"
            class="resource-col"
            :class="{
              'resource-col--drop-target': dragGhost && !dragGhost.invalid && dragGhost.targetResourceId === col.resource.id,
              'resource-col--drop-invalid': dragGhost && dragGhost.invalid && dragGhost.targetResourceId === col.resource.id,
            }"
            :data-resource-id="col.resource.id"
          >
            <div
              v-for="(range, i) in col.dimRanges"
              :key="`dim-${i}`"
              class="dim"
              :class="{ 'dim--disabled': range.kind === 'disabled' }"
              :style="{ top: `${range.top}px`, height: `${range.height}px` }"
            />

            <button
              v-for="slot in col.slots"
              :key="slot.minutes"
              type="button"
              class="slot"
              :style="{ top: `${slot.top}px`, height: `${slotHeightPx}px` }"
              @click="onSlotClick(col.resource.id, slot.time)"
            />

            <button
              v-for="appt in col.appointments"
              :key="appt.id"
              type="button"
              class="appt-card"
              :class="[`status-${appt.status}`, {
                'appt-card--editable': editable && appt.status !== 'cancelled',
                'appt-card--dragging': dragState && dragState.appt.id === appt.id,
              }]"
              :style="cardStyle(appt)"
              @pointerdown="onCardPointerDown($event, appt, col.resource.id)"
              @pointermove="onCardPointerMove"
              @pointerup="onCardPointerUp"
              @pointercancel="onCardPointerCancel"
            >
              <UiText size="tiny" weight="medium" class="appt-customer">
                {{ appt.customerName }}
              </UiText>
              <UiText v-if="appt.customerPhone && !hidePhones" size="tiny" class="appt-phone">
                {{ appt.customerPhone }}
              </UiText>
              <UiText size="tiny" class="appt-service">{{ appt.serviceName }}</UiText>
              <UiText v-if="appt.notes" size="tiny" class="appt-notes">{{ appt.notes }}</UiText>
            </button>

            <div
              v-if="dragGhost && dragGhost.targetResourceId === col.resource.id"
              class="drag-ghost"
              :class="{ 'drag-ghost--invalid': dragGhost.invalid }"
              :style="dragGhost.style"
            >
              <UiText
                v-if="dragGhost.reason"
                size="tiny"
                weight="medium"
                class="ghost-reason"
              >
                {{ dragGhost.reason }}
              </UiText>
            </div>
          </div>

          <div
            v-if="nowTop !== null"
            class="now-line"
            :style="{ top: `${nowTop}px` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { UiText } from '@fastio/ui'
import type { Appointment, Resource } from '@fastio/shared'
import type { TimelineAvailability } from '~/utils/services/timelineAvailability'
import { useTimelineLayout } from '~/composables/services/timeline/useTimelineLayout'
import { useTimelineDrag } from '~/composables/services/timeline/useTimelineDrag'
import { useScrollToNow } from '~/composables/services/timeline/useScrollToNow'

type Props = {
  resources: Resource[]
  appointments: Appointment[]
  availability: TimelineAvailability
  windowOpen: string
  windowClose: string
  slotStep: number
  tz: string
  pxPerMin?: number
  resourceLabel?: string
  editable?: boolean
  now?: number | null
  // True если selectedDate === todayInTz(tz). Используется чтобы
  // диммить слоты в прошлом и не давать на них кликать.
  dateIsToday?: boolean
  // True для мастера с view_own — телефон клиента в карточках не показываем.
  hidePhones?: boolean
  // Валидатор drop'а из родителя — возвращает текстовую причину блокировки
  // или null если drop валиден. Причина показывается внутри ghost-блока.
  getMoveBlocker?: (payload: { appt: Appointment; dyMin: number; newResourceId: string }) => string | null
}

// pxPerMin=1.6 → 30-минутный слот занимает 48px. Под высоту строки таблицы
// (48px из старой версии) и комфортное чтение тел текста в одном слоте.
const props = withDefaults(defineProps<Props>(), {
  pxPerMin: 1.6,
  resourceLabel: '',
  editable: false,
  now: null,
  dateIsToday: false,
  hidePhones: false,
})

const emit = defineEmits<{
  apptClick: [appt: Appointment]
  cellClick: [payload: { resourceId: string; time: string }]
  apptMove: [payload: { appt: Appointment; dyMin: number; newResourceId: string }]
}>()

const scrollRef = ref<HTMLElement | null>(null)

const slotStepRef = toRef(props, 'slotStep')
const pxPerMinRef = toRef(props, 'pxPerMin')

const {
  windowStartMin, totalPx, slotHeightPx,
  hourTicks, isoToWindowMinutes, nowTop,
  columnsModel, cardStyle,
} = useTimelineLayout({
  resources: toRef(props, 'resources'),
  appointments: toRef(props, 'appointments'),
  availability: toRef(props, 'availability'),
  windowOpen: toRef(props, 'windowOpen'),
  windowClose: toRef(props, 'windowClose'),
  slotStep: slotStepRef,
  pxPerMin: pxPerMinRef,
  tz: toRef(props, 'tz'),
  now: toRef(props, 'now'),
  dateIsToday: toRef(props, 'dateIsToday'),
})

const rootCssVars = computed(() => ({
  '--tl-px-per-min': String(props.pxPerMin),
  '--tl-slot-px': `${props.slotStep * props.pxPerMin}px`,
  '--tl-hour-px': `${60 * props.pxPerMin}px`,
  '--tl-total-px': `${totalPx.value}px`,
}))

const onSlotClick = (resourceId: string, time: string) => {
  emit('cellClick', { resourceId, time })
}

const {
  dragState, dragGhost,
  onCardPointerDown, onCardPointerMove, onCardPointerUp, onCardPointerCancel,
} = useTimelineDrag({
  editable: toRef(props, 'editable'),
  pxPerMin: pxPerMinRef,
  slotStep: slotStepRef,
  windowStartMin,
  isoToWindowMinutes,
  getMoveBlocker: props.getMoveBlocker,
  onClick: (appt) => emit('apptClick', appt),
  onMove: (payload) => emit('apptMove', payload),
})

const { scrollToNow } = useScrollToNow({ scrollRef, nowTop })

defineExpose({ scrollToNow })
</script>

<style scoped lang="scss">
.grid-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  overflow: hidden;
  background: var(--color-bg-card);
}

.grid-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
}

.grid-header {
  display: flex;
  background: var(--color-bg-hover);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 4;
}

.time-col-header {
  width: 64px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  position: sticky;
  left: 0;
  background: var(--color-bg-hover);
  z-index: 1;
}

.resource-col-header {
  flex: 1;
  min-width: 140px;
  padding: var(--space-8) var(--space-12);
  border-left: 1px solid var(--color-border);

  &:first-of-type {
    border-left: none;
  }
}

.resource-type {
  color: var(--color-text-hint);
}

.grid-content {
  display: flex;
  align-items: stretch;
  position: relative;
  padding: var(--space-16) 0;
}

.time-col {
  width: 64px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-card);
  position: sticky;
  left: 0;
  z-index: 3;
  height: var(--tl-total-px);
}

.time-tick {
  position: absolute;
  left: 0;
  right: 0;
  padding: 0 var(--space-8);
  transform: translateY(-50%);
  pointer-events: none;
}

.time-label {
  color: var(--color-text-secondary);
  line-height: 1;
}

.now-marker {
  position: absolute;
  right: -5px;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  background: var(--color-error);
  transform: translateY(-50%);
  z-index: 4;
  pointer-events: none;
}

.resources-canvas {
  display: flex;
  flex: 1;
  height: var(--tl-total-px);
  position: relative;
}

.now-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--color-error);
  pointer-events: none;
  // Между slot (1) и appt-card (2) — карточки и time-col (3) её перекрывают.
  z-index: 2;
}

.resource-col {
  flex: 1;
  min-width: 140px;
  position: relative;
  border-left: 1px solid var(--color-border);
  background-image:
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(var(--tl-hour-px) - 1px),
      var(--color-border) calc(var(--tl-hour-px) - 1px),
      var(--color-border) var(--tl-hour-px)
    ),
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(var(--tl-slot-px) - 1px),
      var(--color-border-light) calc(var(--tl-slot-px) - 1px),
      var(--color-border-light) var(--tl-slot-px)
    );

  &:first-of-type {
    border-left: none;
  }

  &--drop-target {
    background-color: var(--color-primary-soft);
  }

  &--drop-invalid {
    background-color: var(--color-error-light);
  }
}

.dim {
  position: absolute;
  left: 0;
  right: 0;
  // Полупрозрачно — чтобы repeating-linear-gradient линии часов/слотов из
  // resource-col просвечивали и сохранялась визуальная структура сетки.
  background-color: var(--timeline-dim-bg);
  pointer-events: none;
  z-index: 0;
}

.dim--disabled {
  background-color: transparent;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent 0,
    transparent 6px,
    var(--timeline-dim-stripe) 6px,
    var(--timeline-dim-stripe) 12px
  );
}

.slot {
  position: absolute;
  left: 0;
  right: 0;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: 1;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--color-primary-soft);
  }
}

.appt-card {
  position: absolute;
  left: 2px;
  right: 2px;
  border: none;
  border-left-width: 3px;
  border-left-style: solid;
  border-radius: var(--radius-8);
  padding: var(--space-4) var(--space-8);
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  font-family: inherit;
  z-index: 2;
  touch-action: none;

  &--editable {
    cursor: grab;
  }

  &--dragging {
    cursor: grabbing;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:hover {
    filter: brightness(0.97);
  }

  &.status-new {
    background: var(--yellow-100);
    border-left-color: var(--yellow-500);
  }

  &.status-confirmed {
    background: var(--green-100);
    border-left-color: var(--green-500);
  }

  &.status-done {
    background: var(--grey-100);
    border-left-color: var(--grey-400);
  }

  &.status-cancelled {
    background: var(--red-100);
    border-left-color: var(--red-500);
    opacity: 0.6;
  }
}

.drag-ghost {
  position: absolute;
  left: 2px;
  right: 2px;
  border: 2px dashed var(--color-primary);
  border-radius: var(--radius-8);
  background: var(--color-primary-soft);
  pointer-events: none;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4) var(--space-8);
  text-align: center;

  &--invalid {
    border-color: var(--color-error);
    background: var(--color-error-light);
  }
}

.ghost-reason {
  color: var(--color-error);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.appt-customer {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.appt-phone {
  color: var(--color-text-hint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.appt-service {
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.appt-notes {
  color: var(--color-text-hint);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
</style>
