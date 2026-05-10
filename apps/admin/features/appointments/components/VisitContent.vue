<template>
  <div class="visit-content-root">
    <div v-if="props.initialVisit" class="meta-row">
      <span class="meta-title">
        Визит клиента {{ props.initialVisit.customerName }}
      </span>
      <UiText v-if="visitDateText" size="small" class="muted">
        {{ visitDateText }}{{ branchName ? ` • ${branchName}` : '' }}
      </UiText>
      <UiTag v-if="overlapWarning" type="error" size="small">
        {{ overlapWarning }}
      </UiTag>
      <UiTag v-if="gapWarning" type="warning" size="small">
        {{ gapWarning }}
      </UiTag>
    </div>

    <UiSkeleton v-if="editor.loadingResources.value" :repeat="6" />

    <template v-else>
      <UiCard class="date-picker-card">
        <div class="date-branch-row">
          <div class="date-col">
            <UiTitle size="h4" class="card-title">Дата визита</UiTitle>
            <UiDatepicker v-model="dateTs" placeholder="Выберите дату" />
            <UiText v-if="dateChanged" size="tiny" class="date-changed-hint">
              При сохранении все услуги визита переедут на новую дату.
            </UiText>
          </div>
          <div v-if="branchStore.branches.length > 1" class="branch-col">
            <UiTitle size="h4" class="card-title">Филиал</UiTitle>
            <UiSelect
              v-if="!branchSelectDisabled"
              :value="editor.state.branchId"
              :options="branchOptions"
              placeholder="Выберите филиал"
              @update:value="onBranchSelect"
            />
            <UiText v-else>{{ editorBranchName }}</UiText>
          </div>
        </div>
      </UiCard>

      <div class="content-grid">
        <div class="col">
          <VisitServicesSection
            :services="editor.state.services"
            :existing-service-ids="editor.existingServiceIds.value"
            :is-read-only="editor.isReadOnly.value"
            :saving="editor.saving.value"
            :branch-id="editor.state.branchId"
            :appointments="props.initialAppointments"
            :selected-key="editor.selectedServiceKey.value"
            :resource-display-name="editor.resourceDisplayName"
            :resource-name-by-id="editor.resourceNameById"
            :validity-by-key="editor.validityByKey.value"
            @add="editor.addService"
            @remove="editor.removeService"
            @restore="editor.restoreService"
            @select="(key: string) => editor.selectedServiceKey.value = key"
          />

          <UiCard v-if="editor.totals.value.duration > 0 || editor.totals.value.price > 0">
            <UiTitle size="h4" class="card-title">Итого</UiTitle>
            <div class="totals-list">
              <div class="total-row">
                <UiText size="small" class="total-label">Длительность</UiText>
                <UiText size="small">{{ formatMinutes(editor.totals.value.duration) }}</UiText>
              </div>
              <div class="total-row">
                <UiText size="small" class="total-label">Стоимость</UiText>
                <UiText size="small">{{ formatPrice(editor.totals.value.price) }}</UiText>
              </div>
              <div v-if="props.initialVisit?.source" class="total-row">
                <UiText size="small" class="total-label">Источник</UiText>
                <UiText size="small">{{ APPOINTMENT_SOURCE_LABELS[props.initialVisit.source] }}</UiText>
              </div>
            </div>
          </UiCard>
        </div>

        <div class="col">
          <AppointmentServiceSlotsSection
            :selected-service="editor.selectedService.value"
            :loading="editor.loadingSlots.value"
            :slots-result="editor.slotsResult.value"
            :is-read-only="editor.isReadOnly.value"
            :has-date="!!editor.state.date"
            :resource-options-for="editor.resourceOptionsFor"
            :resource-display-name="editor.resourceDisplayName"
            :service-name-by-id="editor.serviceNameById"
            @select-slot="editor.applySlotToSelected"
            @set-preferred-resource="editor.setPreferredResource"
          />

          <AppointmentCustomerSection
            v-model:customer-name="editor.state.customerName"
            v-model:customer-phone="editor.state.customerPhone"
            v-model:notes="editor.state.notes"
            :disabled="editor.isReadOnly.value || editor.saving.value"
          />

          <UiCard v-if="props.initialEvents && props.initialEvents.length > 0">
            <UiTitle size="h4" class="card-title">События</UiTitle>
            <AppointmentEventTimeline :events="props.initialEvents" :timezone="editor.tz.value" />
          </UiCard>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiTitle, UiText, UiSkeleton, UiTag, UiDatepicker, UiSelect } from '@fastio/ui'
import type {
  Appointment, Visit,
  AppointmentEvent,
} from '@fastio/shared'
import {
  formatPrice, formatMinutes,
  APPOINTMENT_SOURCE_LABELS,
} from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useAppointmentEditorState } from '../composables/useAppointmentEditorState'
import VisitServicesSection from './VisitServicesSection.vue'
import AppointmentServiceSlotsSection from './AppointmentServiceSlotsSection.vue'
import AppointmentCustomerSection from './AppointmentCustomerSection.vue'
import AppointmentEventTimeline from './AppointmentEventTimeline.vue'

export type EditorPreset = {
  date: string | null
  slotTime: string | null
  preferredResourceId: string | null
  branchId: string | null
}

type Props = {
  mode: 'edit' | 'create'
  initialVisit?: Visit | null
  initialAppointments?: Appointment[]
  initialEvents?: AppointmentEvent[]
  initialPreset?: EditorPreset | null
}

const props = withDefaults(defineProps<Props>(), {
  initialVisit: null,
  initialAppointments: () => [],
  initialEvents: () => [],
  initialPreset: null,
})

const emit = defineEmits<{
  saved: []
}>()

const tenantStore = useTenantStore()
const branchStore = useBranchStore()

const editor = useAppointmentEditorState({
  mode: props.mode,
  initialVisit: props.initialVisit,
  initialAppointments: props.initialAppointments,
  initialPreset: props.initialPreset,
})

// Датапикер показываем для любого визита: для request — выбираем дату с нуля,
// для active — даёт возможность переноса визита целиком на другой день.
// Подсветка «дата изменилась относительно сохранённой» — только для active
// (для request изначально null, информативности нет).
const dateChanged = computed(() => props.initialVisit?.status === 'active'
  && !!props.initialVisit.businessDate
  && editor.state.date !== props.initialVisit.businessDate)

const branchOptions = computed(() => branchStore.branches.map((b) => ({ label: b.name, value: b.id })))

// В edit-mode филиал зафиксирован при создании визита (см. LATER.md → перенос
// визита в другой филиал — отдельная фича через RPC). Селект → readonly.
const branchSelectDisabled = computed(() => props.mode === 'edit'
  || editor.isReadOnly.value
  || editor.saving.value)

const onBranchSelect = (v: string | number | (string | number)[] | null) => {
  editor.state.branchId = typeof v === 'string' ? v : null
}

// Имя филиала из state (для readonly-отображения в edit-mode внутри карточки даты).
const editorBranchName = computed(() => {
  if (!editor.state.branchId) return 'Не указан'

  return branchStore.branches.find((b) => b.id === editor.state.branchId)?.name ?? 'Неизвестный филиал'
})

const dateTs = computed<number | null>({
  get: () => {
    if (!editor.state.date) return null
    const [y, m, d] = editor.state.date.split('-').map(Number)

    return new Date(y, m - 1, d).getTime()
  },
  set: (ts: number | null) => {
    if (!ts) {
      editor.state.date = null

      return
    }
    const d = new Date(ts)

    editor.state.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },
})

const branchName = computed(() => {
  if (!props.initialVisit?.branchId) return null

  return branchStore.branches.find((b) => b.id === props.initialVisit!.branchId)?.name ?? null
})

const visitDateText = computed(() => {
  const first = props.initialAppointments?.[0]

  if (!first) return ''

  return new Intl.DateTimeFormat('ru', {
    timeZone: tenantStore.tenant?.timezone ?? 'UTC',
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(first.startsAt))
})

// Алерты про расположение слотов внутри визита. Live-индикаторы: реагируют на
// добавление/смену слотов в draft'е до сохранения.
//   - overlap (красный): два слота пересекаются по времени
//   - gap ≥ 30 мин (оранжевый): слишком большое окно между услугами
const GAP_THRESHOLD_MIN = 30

const timeStrToMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number)

  return h * 60 + m
}

const slottedSorted = computed(() => editor.state.services
  .filter((s) => !s.pendingRemove && s.currentStartTime && s.currentEndTime)
  .map((s) => ({
    startMin: timeStrToMin(s.currentStartTime!),
    endMin: timeStrToMin(s.currentEndTime!),
  }))
  .sort((a, b) => a.startMin - b.startMin))

const overlapWarning = computed<string | null>(() => {
  const list = slottedSorted.value

  for (let i = 1; i < list.length; i++) {
    if (list[i].startMin < list[i - 1].endMin) {
      return 'Услуги пересекаются по времени'
    }
  }

  return null
})

const gapWarning = computed<string | null>(() => {
  // Если уже есть пересечение — оранжевый не показываем, проблема серьёзнее.
  if (overlapWarning.value) return null

  const list = slottedSorted.value

  for (let i = 1; i < list.length; i++) {
    const gap = list[i].startMin - list[i - 1].endMin

    if (gap >= GAP_THRESHOLD_MIN) {
      return `Окно между услугами ${formatMinutes(gap)} — можно подобрать слоты плотнее`
    }
  }

  return null
})

const save = async () => {
  const ok = await editor.save()

  if (ok) emit('saved')
}

defineExpose({
  save,
  saving: editor.saving,
  dirty: editor.dirty,
  canSave: editor.canSave,
  hasInvalidSlots: editor.hasInvalidSlots,
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as mq;

.visit-content-root {
  @include flex-col(var(--space-16));
}

.meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-12);
}

.date-picker-card {
  margin-bottom: var(--space-8);
}

.date-branch-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-16);

  @include mq.mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.date-col,
.branch-col {
  @include flex-col(var(--space-4));
}

.date-changed-hint {
  display: block;
  margin-top: var(--space-4);
  color: var(--color-warning);
}

.meta-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-16);

  @include mq.mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.col {
  @include flex-col(var(--space-16));
}

.card-title {
  margin-bottom: var(--space-12);
}

.totals-list {
  @include flex-col(var(--space-8));
}

.total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.total-label {
  color: var(--color-text-secondary);
}

.muted {
  color: var(--color-text-secondary);
}
</style>
