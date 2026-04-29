<template>
  <UiDrawer
    :model-value="modelValue"
    :title="appointment ? 'Запись' : 'Новая запись'"
    :width="480"
    :actions="footerActions"
    :on-confirm="handleConfirmAction"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-if="appointment || creating" class="content">
      <UiCollapse :expanded-names="['data']">
        <UiCollapseItem name="data" :title="appointment ? 'Запись' : 'Новая запись'">
          <!-- Статус-блок (только для существующих записей) -->
          <UiCard v-if="appointment" size="small" class="status-block">
            <div class="status-row">
              <UiBadge :type="statusType(appointment.status)">{{ statusLabel(appointment.status) }}</UiBadge>
              <UiText size="small" class="time-info">
                {{ formatDateTime(appointment.startsAt) }} — {{ formatTime(appointment.actualEndsAt ?? appointment.endsAt) }}
                <UiText
                  v-if="isOpenEnded"
                  size="tiny"
                  span
                  class="mode-tag"
                >продлеваемое</UiText>
              </UiText>
            </div>

            <div v-if="statusActions.length" class="status-actions">
              <UiButton
                v-for="action in statusActions"
                :key="action.key"
                :type="action.type"
                size="small"
                :loading="saving"
                @click="action.handler"
              >{{ action.label }}</UiButton>
            </div>
          </UiCard>

          <!-- Open-ended controls -->
          <div v-if="appointment && isOpenEnded && appointment.status === 'confirmed'" class="open-ended-controls">
            <UiButton
              size="small"
              type="default"
              :loading="saving"
              @click="extend(30)"
            >+30 мин</UiButton>
            <UiButton
              size="small"
              type="default"
              :loading="saving"
              @click="extend(60)"
            >+1 час</UiButton>
            <UiButton
              size="small"
              type="primary"
              :loading="saving"
              @click="closeNow"
            >Закрыть сейчас</UiButton>
          </div>

          <!-- Форма (одна для create и edit; readonly для confirmed/done/cancelled) -->
          <UiForm ref="formRef">
            <UiSelect
              v-model:value="form.serviceId"
              label="Услуга"
              :options="serviceOptions"
              name="serviceId"
              filterable
              :disabled="formReadonly"
              :rules="[{ type: 'required', message: 'Выберите услугу' }]"
            />

            <div class="resource-field">
              <UiSelect
                v-model:value="form.resourceId"
                label="Исполнитель"
                :options="resourceOptions"
                clearable
                placeholder="Не назначен"
                :disabled="formReadonly"
              />
              <UiText
                v-if="resourceHint"
                size="tiny"
                class="resource-hint"
                :class="resourceHintClass"
              >
                {{ resourceHint }}
              </UiText>
              <UiText
                v-else-if="noAvailableResources"
                size="tiny"
                class="resource-hint resource-hint--warn"
              >
                В это время нет свободных исполнителей. Выберите другое время.
              </UiText>
            </div>

            <div class="row-2">
              <UiDatepicker v-model="form.dateTs" label="Дата" :disabled="formReadonly" />
              <UiTimepicker v-model="form.time" label="Время" :disabled="formReadonly" />
            </div>

            <UiAlert
              v-if="timeConflict"
              type="warning"
              size="small"
              class="conflict-banner"
            >
              {{ conflictReasonText }}
              <UiButton
                v-if="conflictSuggestion"
                type="text"
                size="small"
                @click="applySuggestion"
              >Перенести на {{ conflictSuggestion }}</UiButton>
            </UiAlert>

            <UiInput
              v-model="form.customerName"
              label="Имя клиента"
              name="customerName"
              :disabled="formReadonly"
              :rules="[{ type: 'required', message: 'Укажите имя' }]"
            />
            <UiInput
              v-model="form.customerPhone"
              label="Телефон"
              name="customerPhone"
              :disabled="formReadonly"
              callable
              :rules="[
                { type: 'required', message: 'Укажите телефон' },
                { type: 'phone', message: 'Введите корректный телефон' },
              ]"
            />
            <UiInput
              v-model="form.notes"
              label="Примечание"
              type="textarea"
              :rows="2"
              :disabled="formReadonly"
            />
          </UiForm>
        </UiCollapseItem>

        <UiCollapseItem v-if="appointment" name="history" title="История">
          <AppointmentEventsSection :appointment-id="appointment.id" :refresh-key="historyRefreshKey" />
        </UiCollapseItem>
      </UiCollapse>
    </div>

    <UiEmpty v-else icon="calendar" text="Запись не выбрана" />
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiDrawer, UiForm, UiInput, UiText, UiBadge, UiButton, UiCard, UiSelect, UiEmpty, UiAlert, UiDatepicker, UiTimepicker, UiCollapse, UiCollapseItem, useMessage } from '@fastio/ui'
import type { DrawerAction } from '@fastio/ui'
import type { Appointment, AppointmentStatus, AppointmentSettings, Resource, Service } from '@fastio/shared'
import { localDateTimeToUtcIso, utcIsoToLocalDateTime } from '@fastio/shared'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'
import { useAppointmentAvailability } from '~/composables/data/useAppointmentAvailability'
import { useAppointmentEventLogger } from '~/composables/data/useAppointmentEventLogger'
import { reportError } from '~/utils/reportError'
import AppointmentEventsSection from '~/components/appointments/AppointmentEventsSection.vue'

type CreatePreset = {
  date: string // YYYY-MM-DD
  slotTime: string // HH:mm
  resourceId: string | null
}

type StatusButton = {
  key: 'confirm' | 'done' | 'cancel'
  label: string
  type: 'primary' | 'default'
  handler: () => Promise<void>
}

const props = defineProps<{
  modelValue: boolean
  appointment: Appointment | null
  resources: Resource[]
  services?: Service[]
  settings?: AppointmentSettings | null
  createPreset?: CreatePreset | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'saved': []
}>()

const api = useDatabase()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const message = useMessage()
const saving = ref(false)
const formRef = ref<{ validate: () => boolean } | null>(null)

const creating = computed(() => !!props.createPreset && !props.appointment)
const tz = computed(() => tenantStore.tenant.timezone)
const slotStep = computed(() => props.settings?.slotStepMinutes ?? 30)

const availability = useAppointmentAvailability()
const eventLogger = useAppointmentEventLogger()
const historyRefreshKey = ref(0)

// Редактирование разрешено для new и confirmed (клиенты часто звонят перенести).
// done/cancelled — терминальные, поля заблокированы.
const formReadonly = computed(() => {
  if (!props.appointment) return false
  const s = props.appointment.status

  return s === 'done' || s === 'cancelled'
})

// ─── Form state (одна форма для create и edit) ───────────

const form = reactive({
  serviceId: null as string | null,
  resourceId: null as string | null,
  dateTs: null as number | null,
  time: '09:00' as string | null,
  customerName: '',
  customerPhone: '',
  notes: '',
})

// Заполнение формы при открытии
watch(() => props.modelValue, (open) => {
  if (!open) return

  if (props.appointment) {
    const a = props.appointment
    const { dateStr, timeStr } = utcIsoToLocalDateTime(a.startsAt, tz.value)
    const [y, m, d] = dateStr.split('-').map(Number)

    form.serviceId = a.serviceId
    form.resourceId = a.resourceId
    form.dateTs = new Date(y, m - 1, d).getTime()
    form.time = timeStr
    form.customerName = a.customerName
    form.customerPhone = a.customerPhone
    form.notes = a.notes ?? ''
  } else if (props.createPreset) {
    const [y, m, d] = props.createPreset.date.split('-').map(Number)

    form.serviceId = null
    form.resourceId = props.createPreset.resourceId
    form.dateTs = new Date(y, m - 1, d).getTime()
    form.time = props.createPreset.slotTime
    form.customerName = ''
    form.customerPhone = ''
    form.notes = ''
  }
}, { immediate: true })

// ─── Computed selectors ──────────────────────────────────

// Дата timestamp'а В ТАЙМЗОНЕ ТЕНАНТА. `getFullYear/Month/Date` отдают
// дату в локальной tz браузера, что для admin-юзера в другом регионе
// сдвинет дату записи на сутки около полуночи.
const tsToDateStr = (ts: number | null): string | null => {
  if (!ts) return null

  return utcIsoToLocalDateTime(new Date(ts).toISOString(), tz.value).dateStr
}

const formDateStr = computed(() => tsToDateStr(form.dateTs))

const selectedService = computed(() => (props.services ?? []).find((s) => s.id === form.serviceId) ?? null)

const isOpenEnded = computed(() => {
  const svc = (props.services ?? []).find((s) => s.id === props.appointment?.serviceId)

  return svc?.bookingMode === 'open_ended'
})

const serviceOptions = computed(() => (props.services ?? []).filter((s) => s.isBookable).map((s) => ({ label: s.name, value: s.id })))

// Загружаем availability при открытии и при смене даты
watch([() => props.modelValue, formDateStr], async ([open, date]) => {
  if (!open || !date) return
  await availability.loadForDate(date, props.services ?? [], props.resources)
}, { immediate: true })

// Проверка доступности по конкретному ресурсу для текущих параметров формы
const checkResource = (resourceId: string) => {
  const date = formDateStr.value
  const svc = selectedService.value

  if (!availability.ready.value || !date || !svc || !form.time) return null
  const startsAt = localDateTimeToUtcIso(date, form.time, tz.value)
  const [h, m] = form.time.split(':').map(Number)
  const endMin = h * 60 + m + svc.duration
  const endHH = String(Math.floor(endMin / 60)).padStart(2, '0')
  const endMM = String(endMin % 60).padStart(2, '0')
  const endsAt = localDateTimeToUtcIso(date, `${endHH}:${endMM}`, tz.value)

  return availability.checkResource(
    resourceId, svc.id, startsAt, endsAt, date, svc.duration, slotStep.value, props.appointment?.id,
  )
}

// Жёсткий фильтр: только подходящие исполнители (компетентен + работает + свободен).
// Текущий ресурс записи всегда в списке — иначе нельзя было бы его «снять».
// Пока availability не загружен — показываем всё (без фильтра), чтобы не моргать пустотой.
const resourceOptions = computed(() => {
  const filtered = props.resources.filter((r) => {
    if (props.appointment?.resourceId === r.id) return true
    const check = checkResource(r.id)

    if (!check) return true

    return check.reason === 'ok'
  })

  return [
    { label: 'Не назначен', value: null },
    ...filtered.map((r) => ({ label: r.name, value: r.id })),
  ]
})

// Если все исполнители отфильтрованы — пишем явно «свободных нет».
const noAvailableResources = computed(() => {
  if (!availability.ready.value || !selectedService.value || !form.time || !formDateStr.value) return false
  const validCount = props.resources.filter((r) => {
    const c = checkResource(r.id)

    return c && c.reason === 'ok'
  }).length

  return validCount === 0 && props.resources.length > 0
})

// Подсказка под пикером — про текущий выбор
const resourceHint = computed(() => {
  if (!form.resourceId || !availability.ready.value) return ''
  const check = checkResource(form.resourceId)

  if (!check) return ''
  if (check.reason === 'ok') return ''
  if (check.reason === 'not-competent') return 'Этот исполнитель не оказывает выбранную услугу'
  if (check.reason === 'day-off') return 'У исполнителя выходной в этот день'
  if (check.reason === 'busy') return 'Исполнитель занят в это время'

  return ''
})

const resourceHintClass = computed(() => resourceHint.value ? 'resource-hint--warn' : '')

// ─── Time conflict / suggestion ──────────────────────────

const timeConflict = computed(() => {
  if (!form.resourceId) return null
  const check = checkResource(form.resourceId)

  if (!check) return null
  if (check.reason === 'busy' || check.reason === 'day-off') return check

  return null
})

const conflictSuggestion = computed(() => {
  const conflict = timeConflict.value

  if (!conflict || conflict.reason !== 'busy') return null
  const date = formDateStr.value
  const svc = selectedService.value

  if (!date || !svc || !form.time || !form.resourceId) return null

  return availability.nextFreeSlotSameDay(
    form.resourceId, date, svc.duration, slotStep.value, form.time, props.appointment?.id,
  )
})

const conflictReasonText = computed(() => {
  const c = timeConflict.value

  if (!c) return ''
  if (c.reason === 'day-off') return 'У исполнителя выходной в этот день'
  if (c.reason === 'busy') {
    if (conflictSuggestion.value) return 'В это время исполнитель занят'

    return 'В этот день у исполнителя нет свободных слотов'
  }

  return ''
})

const applySuggestion = () => {
  if (conflictSuggestion.value) form.time = conflictSuggestion.value
}

// ─── Status block ────────────────────────────────────────

const statusLabel = (s: AppointmentStatus) => ({
  new: 'Новая', confirmed: 'Подтверждена', done: 'Завершена', cancelled: 'Отменена',
}[s])

const statusType = (s: AppointmentStatus): 'default' | 'success' | 'warning' | 'error' => ({
  new: 'warning' as const, confirmed: 'success' as const, done: 'default' as const, cancelled: 'error' as const,
}[s])

const formatDateTime = (iso: string) => new Intl.DateTimeFormat('ru', {
  timeZone: tz.value,
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso))

const formatTime = (iso: string) => new Intl.DateTimeFormat('ru', {
  timeZone: tz.value,
  hour: '2-digit', minute: '2-digit',
}).format(new Date(iso))

const statusActions = computed<StatusButton[]>(() => {
  if (!props.appointment) return []
  const s = props.appointment.status

  if (s === 'new') {
    return [
      { key: 'confirm', label: 'Подтвердить', type: 'primary', handler: confirmStatus },
      { key: 'cancel', label: 'Отменить', type: 'default', handler: cancelStatus },
    ]
  }
  if (s === 'confirmed') {
    return [
      { key: 'done', label: 'Завершить', type: 'primary', handler: markDoneStatus },
      { key: 'cancel', label: 'Отменить', type: 'default', handler: cancelStatus },
    ]
  }

  return []
})

// ─── Helpers ─────────────────────────────────────────────

// Считает endsAt по выбранным дате+времени и duration услуги.
// localDateTimeToUtcIso корректно обрабатывает «час > 23» через Date.UTC overflow,
// поэтому НЕ делаем `% 24` — иначе ends_at окажется на сутки раньше starts_at для
// записей, переходящих через полночь (баня/бильярд +90 мин начатые в 23:00).
const computeStartsEnds = (): { startsAt: string; endsAt: string } | null => {
  const dateStr = formDateStr.value
  const svc = selectedService.value

  if (!dateStr || !form.time || !svc) return null

  const startsAt = localDateTimeToUtcIso(dateStr, form.time, tz.value)
  const [h, m] = form.time.split(':').map(Number)
  const endMin = h * 60 + m + svc.duration
  const endHH = String(Math.floor(endMin / 60)).padStart(2, '0')
  const endMM = String(endMin % 60).padStart(2, '0')
  const endsAt = localDateTimeToUtcIso(dateStr, `${endHH}:${endMM}`, tz.value)

  return { startsAt, endsAt }
}

// ─── Save / create ───────────────────────────────────────

const buildFormPatch = () => ({
  serviceId: form.serviceId!,
  serviceName: selectedService.value?.name ?? '',
  servicePrice: selectedService.value?.price ?? 0,
  resourceId: form.resourceId,
  customerName: form.customerName.trim(),
  customerPhone: form.customerPhone.trim(),
  notes: form.notes.trim() || null,
})

const validateForm = (): boolean => !!formRef.value?.validate()

const lookups = {
  serviceName: (id: string) => (props.services ?? []).find((s) => s.id === id)?.name ?? null,
  resourceName: (id: string | null) => id ? props.resources.find((r) => r.id === id)?.name ?? null : null,
}

const saveExisting = async (): Promise<boolean> => {
  if (!props.appointment) return false
  if (!validateForm()) return false
  const times = computeStartsEnds()

  if (!times) return false

  const before = props.appointment
  const patch = { ...buildFormPatch(), startsAt: times.startsAt, endsAt: times.endsAt }

  saving.value = true
  try {
    await api.appointments.update(before.id, patch)
    eventLogger.logFormDiff(
      {
        serviceId: patch.serviceId,
        resourceId: patch.resourceId,
        customerName: patch.customerName,
        customerPhone: patch.customerPhone,
        notes: patch.notes,
        startsAt: patch.startsAt,
        endsAt: patch.endsAt,
      },
      before,
      lookups,
    )
    historyRefreshKey.value++
    emit('saved')

    return true
  } catch (e) {
    reportError(e)
    message.error('Не удалось сохранить запись')

    return false
  } finally {
    saving.value = false
  }
}

const createNew = async (): Promise<boolean> => {
  if (!validateForm()) return false
  const tid = tenantStore.currentTenantId
  const times = computeStartsEnds()

  if (!tid || !times) return false

  saving.value = true
  try {
    await api.appointments.create(tid, {
      ...buildFormPatch(),
      branchId: null,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      status: 'confirmed',
    })
    emit('saved')

    return true
  } catch (e) {
    reportError(e)
    message.error('Не удалось создать запись')

    return false
  } finally {
    saving.value = false
  }
}

// ─── Status transitions ──────────────────────────────────

const confirmStatus = async () => {
  if (!props.appointment || !authStore.user) return
  // Сначала сохраняем форму, потом меняем статус — чтобы изменения не пропали.
  const before = props.appointment

  if (!await saveExisting()) return
  saving.value = true
  try {
    await api.appointments.confirm(before.id, authStore.user.id)
    eventLogger.logStatusChange(before, before.status, 'confirmed')
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    reportError(e)
    message.error('Не удалось подтвердить запись')
  } finally {
    saving.value = false
  }
}

const cancelStatus = async () => {
  if (!props.appointment) return
  const before = props.appointment

  saving.value = true
  try {
    await api.appointments.cancel(before.id)
    eventLogger.logStatusChange(before, before.status, 'cancelled')
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    reportError(e)
    message.error('Не удалось отменить запись')
  } finally {
    saving.value = false
  }
}

const markDoneStatus = async () => {
  if (!props.appointment) return
  const before = props.appointment

  if (!await saveExisting()) return
  saving.value = true
  try {
    await api.appointments.markDone(before.id)
    eventLogger.logStatusChange(before, before.status, 'done')
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    reportError(e)
    message.error('Не удалось завершить запись')
  } finally {
    saving.value = false
  }
}

// ─── Open-ended controls ─────────────────────────────────

const extend = async (minutes: number) => {
  if (!props.appointment) return
  const before = props.appointment

  saving.value = true
  try {
    await api.appointments.extend(before.id, minutes)
    eventLogger.logExtended(before, minutes)
    historyRefreshKey.value++
    emit('saved')
  } catch (e) {
    reportError(e)
    message.error('Не удалось продлить запись')
  } finally {
    saving.value = false
  }
}

const closeNow = async () => {
  if (!props.appointment) return
  const before = props.appointment

  saving.value = true
  try {
    await api.appointments.closeNow(before.id)
    eventLogger.logClosedNow(before)
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    reportError(e)
    message.error('Не удалось закрыть запись')
  } finally {
    saving.value = false
  }
}

// ─── Footer actions ──────────────────────────────────────

const footerActions = computed<DrawerAction[] | undefined>(() => {
  if (creating.value) {
    return [
      { text: 'Создать', type: 'primary', actionType: 'confirm' },
      { text: 'Отмена', type: 'default', actionType: 'decline' },
    ]
  }
  if (props.appointment && !formReadonly.value) {
    return [
      { text: 'Сохранить', type: 'primary', actionType: 'confirm', loading: saving.value },
      { text: 'Закрыть', type: 'default', actionType: 'decline' },
    ]
  }

  // Подтверждённая/завершённая/отменённая — только закрыть, без сохранения.
  return [
    { text: 'Закрыть', type: 'default', actionType: 'decline' },
  ]
})

const handleConfirmAction = async (): Promise<boolean> => {
  if (creating.value) return createNew()
  if (props.appointment) return saveExisting()

  return false
}
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
}

.status-block {
  gap: var(--space-12);
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  flex-wrap: wrap;
}

.time-info {
  color: var(--color-text-secondary);
}

.mode-tag {
  margin-left: var(--space-4);
  padding: 1px 6px;
  border-radius: var(--radius-4);
  background: var(--color-bg-subtle);
  font-size: 11px;
  color: var(--color-text-secondary);
}

.status-actions {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.open-ended-controls {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
}

.resource-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.resource-hint {
  color: var(--color-text-secondary);

  &--warn {
    color: var(--color-warning);
  }
}

.resource-toggle {
  margin-top: var(--space-4);
}

</style>
