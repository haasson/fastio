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
            <template v-for="(range, i) in col.dimRanges" :key="`dim-${i}`">
              <div
                v-if="range.kind !== 'absence'"
                class="dim"
                :class="{ 'dim--disabled': range.kind === 'disabled' }"
                :style="{ top: `${range.top}px`, height: `${range.height}px` }"
              />
              <div
                v-else
                class="absence-block"
                :style="{ top: `${range.top}px`, height: `${range.height}px` }"
              >
                <div class="absence-strip">
                  <span class="absence-label">{{ range.label }}</span>
                  <span v-if="range.notes" class="absence-notes">{{ range.notes }}</span>
                </div>
                <div class="absence-body" />
              </div>
            </template>

            <div
              v-for="slot in col.slots"
              :key="slot.minutes"
              class="slot"
              :style="{ top: `${slot.top}px`, height: `${slotHeightPx}px` }"
              @click="onSlotClick(col.resource.id, slot.time)"
            />

            <div
              v-for="appt in col.appointments"
              :key="appt.id"
              class="appt-card"
              :class="{
                'appt-card--editable': editable && appt.status !== 'cancelled',
                'appt-card--dragging': dragState && dragState.appt.id === appt.id,
                'appt-card--cancelled': appt.status === 'cancelled',
              }"
              :style="apptCardStyle(appt)"
              @pointerdown="onCardPointerDown($event, appt, col.resource.id)"
              @pointermove="onCardPointerMove"
              @pointerup="onCardPointerUp"
              @pointercancel="onCardPointerCancel"
            >
              <div class="appt-strip">
                <span class="appt-customer">{{ appt.customerName }}</span>
                <span class="status-dot" :class="`status-dot--${appt.status}`" />
              </div>
              <div class="appt-body">
                <span class="appt-service">{{ appt.serviceName }}</span>
                <span v-if="appt.customerPhone && !hidePhones" class="appt-phone">{{ appt.customerPhone }}</span>
                <span v-if="appt.notes" class="appt-notes">{{ appt.notes }}</span>
              </div>
            </div>

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
import { DEFAULT_CATEGORY_COLOR_HEX } from '@fastio/shared'
import type { TimelineAvailability } from '~/features/appointments/utils/timelineAvailability'
import { useTimelineLayout } from '~/features/appointments/composables/timeline/useTimelineLayout'
import { useTimelineDrag } from '~/features/appointments/composables/timeline/useTimelineDrag'
import { useScrollToNow } from '~/features/appointments/composables/timeline/useScrollToNow'

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
  // serviceId → hex цвет категории; если не задан — используется DEFAULT_CATEGORY_COLOR_HEX.
  categoryColorMap?: Map<string, string>
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
  categoryColorMap: () => new Map(),
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

const apptCardStyle = (appt: Appointment) => {
  const pos = cardStyle(appt)
  const color = (appt.serviceId ? props.categoryColorMap?.get(appt.serviceId) : null) ?? DEFAULT_CATEGORY_COLOR_HEX

  return { ...pos, '--appt-color': color }
}

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
  --timeline-dim-bg: var(--color-bg-hover);
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
    transparent 8px,
    var(--color-border) 8px,
    var(--color-border) 9px
  );
}

.slot {
  position: absolute;
  left: 0;
  right: 0;
  cursor: pointer;
  z-index: 1;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--color-primary-soft);
  }
}

.appt-card {
  position: absolute;
  left: 3px;
  right: 3px;
  border-radius: var(--radius-8);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  // overflow: hidden убран — нужен для sticky .appt-strip.
  // Контент клипится на уровне .appt-body и текстовых span'ов.
  z-index: 2;
  touch-action: none;
  background: color-mix(in srgb, var(--appt-color) 14%, var(--color-bg-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--appt-color) 30%, transparent);

  &--editable {
    cursor: grab;
  }

  &--dragging {
    cursor: grabbing;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  &--cancelled {
    opacity: 0.45;
  }

  &:hover:not(&--dragging) {
    filter: brightness(0.95);
  }
}

.appt-strip {
  background: var(--appt-color);
  padding: 4px var(--space-8);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-shrink: 0;
  overflow: hidden;
  min-height: 22px;
}

.appt-customer {
  flex: 1;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// Точка лежит на цветной шапке (--appt-color), где обычные семантические
// токены (--color-warning/success/error) могут терять контраст. Подмешиваем
// белый через color-mix чтобы вытянуть яркость, белая обводка добавляет
// дополнительный контраст по краю.
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  border: 1.5px solid rgba(255, 255, 255, 0.7);

  &--new       { background: color-mix(in srgb, var(--color-warning) 75%, white); }
  &--confirmed { background: color-mix(in srgb, var(--color-success) 75%, white); }
  &--cancelled { background: color-mix(in srgb, var(--color-error) 75%, white); }
  &--done      { background: rgba(255, 255, 255, 0.55); border-color: rgba(255, 255, 255, 0.4); }
}

// Тело карточки — услуга, телефон, примечания.
// flex: 1 чтобы занять оставшееся место; overflow: hidden чрезмерный контент режет.
.appt-body {
  padding: 3px var(--space-8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.appt-service {
  font-size: 11px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  opacity: 0.75;
}

.appt-phone {
  font-size: 11px;
  color: var(--color-text-hint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.appt-notes {
  font-size: 11px;
  color: var(--color-text-hint);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.absence-block {
  position: absolute;
  left: 3px;
  right: 3px;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-8);
  overflow: hidden;
  z-index: 1;
  pointer-events: none;
  border: 1px solid var(--color-border);
}

.absence-strip {
  background: var(--color-bg-hover);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-4) var(--space-8);
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.absence-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.absence-notes {
  font-size: 10px;
  color: var(--color-text-hint);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.absence-body {
  flex: 1;
  background-color: var(--color-bg-hover);
  background-image: repeating-linear-gradient(
    -45deg,
    transparent 0,
    transparent 8px,
    var(--color-border) 8px,
    var(--color-border) 9px
  );
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

</style>
