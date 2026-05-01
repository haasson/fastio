<template>
  <div class="group-content-root">
    <UiAlert v-if="editor.isClosedStatus.value" type="warning">
      {{ closedBannerText }}. Редактирование недоступно.
    </UiAlert>

    <div v-if="props.initialGroup" class="meta-row">
      <UiTag :type="APPOINTMENT_GROUP_STATUS_TAG_TYPES[props.initialGroup.status]" size="small">
        {{ APPOINTMENT_GROUP_STATUS_LABELS[props.initialGroup.status] }}
      </UiTag>
      <UiText v-if="visitDateText" size="small" class="muted">
        {{ visitDateText }}{{ branchName ? ` • ${branchName}` : '' }}
      </UiText>
    </div>

    <UiSkeleton v-if="editor.loadingResources.value" :repeat="6" />

    <template v-else>
      <div class="content-grid">
        <div class="col">
          <AppointmentGroupServicesSection
            :services="editor.state.services"
            :existing-service-ids="editor.existingServiceIds.value"
            :is-read-only="editor.isReadOnly.value"
            :saving="editor.saving.value"
            :resource-options-for="editor.resourceOptionsFor"
            :resource-display-name="editor.resourceDisplayName"
            :appointment-time-range="editor.appointmentTimeRange"
            @add="editor.addService"
            @remove="editor.removeService"
            @restore="editor.restoreService"
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
              <div v-if="props.initialGroup?.source" class="total-row">
                <UiText size="small" class="total-label">Источник</UiText>
                <UiText size="small">{{ APPOINTMENT_SOURCE_LABELS[props.initialGroup.source] }}</UiText>
              </div>
            </div>
          </UiCard>
        </div>

        <div class="col">
          <AppointmentGroupSlotPickerSection
            v-model:date-ts="editor.dateTs.value"
            v-model:selected-slot-entry="editor.state.selectedSlotEntry"
            :is-read-only="editor.isReadOnly.value"
            :saving="editor.saving.value"
            :has-date="!!editor.state.date"
            :active-services-count="editor.activeServicesCount.value"
            :loading-slots="editor.loadingSlots.value"
            :slots-result="editor.slotsResult.value"
            :totals="editor.totals.value"
            :read-only-date-text="visitDateText"
            :service-name-by-id="editor.serviceNameById"
          />

          <AppointmentCustomerSection
            v-model:customer-name="editor.state.customerName"
            v-model:customer-phone="editor.state.customerPhone"
            v-model:customer-email="editor.state.customerEmail"
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
import { UiCard, UiTitle, UiText, UiTag, UiAlert, UiSkeleton } from '@fastio/ui'
import type {
  Appointment, AppointmentGroup, AppointmentRequest,
  AppointmentEvent,
} from '@fastio/shared'
import {
  formatPrice, formatMinutes,
  APPOINTMENT_GROUP_STATUS_LABELS,
  APPOINTMENT_GROUP_STATUS_TAG_TYPES,
  APPOINTMENT_SOURCE_LABELS,
} from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useAppointmentEditorState } from '~/composables/data/useAppointmentEditorState'
import AppointmentGroupServicesSection from '~/components/appointments/AppointmentGroupServicesSection.vue'
import AppointmentGroupSlotPickerSection from '~/components/appointments/AppointmentGroupSlotPickerSection.vue'
import AppointmentCustomerSection from '~/components/appointments/AppointmentCustomerSection.vue'
import AppointmentEventTimeline from '~/components/appointments/AppointmentEventTimeline.vue'

type Props = {
  mode: 'edit' | 'create'
  initialGroup?: AppointmentGroup | null
  initialAppointments?: Appointment[]
  initialEvents?: AppointmentEvent[]
  initialRequest?: AppointmentRequest | null
}

const props = withDefaults(defineProps<Props>(), {
  initialGroup: null,
  initialAppointments: () => [],
  initialEvents: () => [],
  initialRequest: null,
})

const emit = defineEmits<{ saved: [] }>()

const tenantStore = useTenantStore()
const branchStore = useBranchStore()

const editor = useAppointmentEditorState({
  mode: props.mode,
  initialGroup: props.initialGroup,
  initialAppointments: props.initialAppointments,
  initialRequest: props.initialRequest,
})

// Враппер: editor.save() в edit-mode чистит state и обновляет snapshot, но
// родителю (странице) нужно перечитать данные группы, чтобы подтянуть свежий
// status / events / appointments из БД. В create-mode editor сам делает
// router.push — на этот момент родитель ещё жив, эмит безопасен.
const save = async () => {
  const ok = await editor.save()

  if (ok) emit('saved')
}

const closedBannerText = computed(() => {
  if (props.initialGroup?.status === 'done') return 'Запись завершена'
  if (props.initialGroup?.status === 'cancelled') return 'Запись отменена'

  return 'Запись закрыта'
})

const branchName = computed(() => {
  if (!props.initialGroup?.branchId) return null

  return branchStore.branches.find((b) => b.id === props.initialGroup!.branchId)?.name ?? null
})

const visitDateText = computed(() => {
  const first = props.initialAppointments?.[0]

  if (!first) return ''

  return new Intl.DateTimeFormat('ru', {
    timeZone: tenantStore.tenant?.timezone ?? 'UTC',
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(first.startsAt))
})

defineExpose({
  save,
  saving: editor.saving,
  dirty: editor.dirty,
  canSave: editor.canSave,
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as mq;

.group-content-root {
  @include flex-col(var(--space-16));
}

.meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-8);
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
