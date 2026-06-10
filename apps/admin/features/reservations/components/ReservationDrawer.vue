<template>
  <UiDrawer
    :model-value="modelValue"
    :title="reservation ? `Бронь #${reservation.id.slice(0, 8)}` : 'Новая бронь'"
    :width="560"
    :actions="drawerActions"
    :on-confirm="onSave"
    :on-decline="onDecline"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="content">
      <!-- Status badge (edit mode) -->
      <div v-if="reservation" class="status-row">
        <UiTag :type="STATUS_TYPES[reservation.status]" round size="medium">
          {{ STATUS_LABELS[reservation.status] }}
        </UiTag>
        <UiButton
          v-if="reservation.status === 'confirmed' && !isEditing"
          size="small"
          @click="isEditing = true"
        >Изменить бронь</UiButton>
      </div>

      <!-- Guest info -->
      <UiForm ref="formRef" class="form">
        <div class="row">
          <UiInput
            v-model="form.guestName"
            label="Имя гостя"
            name="guestName"
            :disabled="formDisabled"
            :rules="[validationRules.name.required]"
          />
          <UiInput
            v-model="form.guestPhone"
            label="Телефон"
            name="guestPhone"
            :disabled="formDisabled"
            :rules="[validationRules.phone.required, validationRules.phone.format]"
            callable
          />
        </div>
        <div class="row">
          <UiSelect
            v-model:value="form.reservedDate"
            label="Дата"
            name="reservedDate"
            :options="dateOptions"
            :disabled="formDisabled"
            :rules="[{ type: 'required', message: 'Укажите дату' }]"
            placeholder="Выберите дату"
          />
          <UiSelect
            v-model:value="form.reservedTime"
            label="Время"
            name="reservedTime"
            :options="timeOptions"
            :disabled="formDisabled || !form.reservedDate"
            :rules="[{ type: 'required', message: 'Укажите время' }]"
            placeholder="Выберите время"
          />
        </div>
        <div class="row">
          <UiInputNumber
            v-model="form.guestCount"
            label="Гостей"
            :min="1"
            :max="50"
            :show-button="true"
            :disabled="formDisabled"
          />
          <UiSelect
            v-if="dineInEnabled"
            v-model:value="selectedTableId"
            label="Стол"
            name="tableId"
            :options="tableOptions"
            :disabled="formDisabled"
            :rules="[{ type: 'required', message: 'Выберите стол' }]"
            placeholder="Выберите стол"
          />
        </div>
        <UiInput
          v-model="form.comment"
          type="textarea"
          label="Комментарий"
          :rows="3"
          :disabled="formDisabled"
        />
      </UiForm>

      <!-- Table availability (create mode or pending or confirmed in edit mode) -->
      <template v-if="tables.length && form.reservedDate && (!reservation || reservation.status === 'pending' || (reservation.status === 'confirmed' && isEditing))">
        <UiDivider />
        <ReservationTablePicker
          v-model="selectedTableId"
          :tables="tables"
          :day-reservations="dayReservations"
          :guest-count="form.guestCount"
          :reserved-date="form.reservedDate"
          :timezone="tenantStore.timezone"
        />
      </template>

      <!-- Cancellation reason -->
      <template v-if="showCancelReason">
        <UiDivider />
        <UiInput v-model="cancelReason" label="Причина отмены" />
      </template>

      <!-- Read-only info for closed statuses -->
      <template v-if="reservation && ['completed', 'cancelled', 'no_show'].includes(reservation.status)">
        <UiDivider />
        <div class="info-grid">
          <template v-if="reservation.confirmedAt">
            <UiText size="small" color="secondary">Подтверждена</UiText>
            <UiText size="small">{{ formatDt(reservation.confirmedAt) }}</UiText>
          </template>
          <template v-if="reservation.seatedAt">
            <UiText size="small" color="secondary">Посажен</UiText>
            <UiText size="small">{{ formatDt(reservation.seatedAt) }}</UiText>
          </template>
          <template v-if="reservation.completedAt">
            <UiText size="small" color="secondary">{{ reservation.tableId ? 'Стол закрыт' : 'Завершена' }}</UiText>
            <UiText size="small">{{ formatDt(reservation.completedAt) }}</UiText>
          </template>
          <template v-if="reservation.cancelledAt">
            <UiText size="small" color="secondary">Отменена</UiText>
            <UiText size="small">{{ formatDt(reservation.cancelledAt) }}</UiText>
          </template>
          <template v-if="reservation.cancelReason">
            <UiText size="small" color="secondary">Причина</UiText>
            <UiText size="small">{{ reservation.cancelReason }}</UiText>
          </template>
        </div>
      </template>

      <!-- История изменений -->
      <UiCollapse v-if="reservation?.id" :expanded-names="[]">
        <UiCollapseItem name="audit" title="История изменений">
          <AuditTrail entity-type="reservation" :entity-id="reservation.id" />
        </UiCollapseItem>
      </UiCollapse>
    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiButton, UiCollapse, UiCollapseItem, UiDivider, UiDrawer, UiForm, UiInput, UiInputNumber, UiSelect, UiTag, UiText, useMessage } from '@fastio/ui'
import type { DrawerAction } from '@fastio/ui'
import type { Reservation, ReservationSettings, Table } from '@fastio/shared'
import { validationRules, useConfirm } from '@fastio/kit'
import { reportError } from '@fastio/shared/observability'
import { useReservationsStore } from '../stores/reservations'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAuthStore } from '~/shared/stores/auth'
import { useBranchStore } from '~/shared/stores/branch'
import { useGate } from '~/shared/plan/useGate'
import {
  todayInTz, nowTimeInTz, addDaysToDateStr,
  generateTimeSlots, timeToMinutes,
  getScheduleForDate,
} from '@fastio/shared'
import {
  RESERVATION_STATUS_LABELS as STATUS_LABELS,
  RESERVATION_STATUS_TYPES as STATUS_TYPES,
} from '../utils/reservation-constants'
import ReservationTablePicker from './ReservationTablePicker.vue'
import AuditTrail from '~/features/audit-log/components/AuditTrail.vue'

const props = defineProps<{
  modelValue: boolean
  reservation: Reservation | null
  preselectedTableId?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const reservationsStore = useReservationsStore()
const tenantStore = useTenantStore()
const authStore = useAuthStore()
const branchStore = useBranchStore()
const api = useDatabase()
const { success, error } = useMessage()
const { confirm } = useConfirm()
const gate = useGate()
const dineInEnabled = computed(() => gate.dineIn.value.enabled)

const form = reactive({
  guestName: '',
  guestPhone: '',
  reservedDate: '',
  reservedTime: '',
  guestCount: 2,
  comment: '',
})

const selectedTableId = ref<string | null>(null)
const cancelReason = ref('')
const showCancelReason = ref(false)
const formRef = ref<InstanceType<typeof UiForm> | null>(null)
const saving = ref(false)
const isEditing = ref(false)

const formDisabled = computed(() => {
  if (!props.reservation) return false
  if (props.reservation.status === 'pending') return false
  if (props.reservation.status === 'confirmed' && isEditing.value) return false

  return true
})

const tables = ref<Table[]>([])

const tableOptions = computed(() => {
  const suitable = tables.value.filter((t) => t.isActive && (t.capacity === null || t.capacity >= form.guestCount),
  )

  if (!suitable.length) {
    return [{ label: 'Нет подходящих столов', value: null, disabled: true }]
  }

  return suitable.map((t) => ({
    label: t.capacity ? `${t.name} (до ${t.capacity} чел.)` : t.name,
    value: t.id,
  }))
})

// Load tables and reservation settings
watch([() => tenantStore.currentTenantId, dineInEnabled, () => branchStore.currentBranchId], async ([id, enabled]) => {
  if (!id || !enabled) {
    tables.value = []

    return
  }
  tables.value = await api.tables.list(id, branchStore.currentBranchId)
}, { immediate: true })

const reservationSettings = ref<ReservationSettings | null>(null)

watch(() => tenantStore.currentTenantId, async (id) => {
  if (!id) return
  reservationSettings.value = await api.reservationSettings.get(id)
}, { immediate: true })

const activeSchedule = computed(() => branchStore.currentBranch?.workingHoursSchedule ?? tenantStore.tenant?.workingHoursSchedule ?? null,
)

const formatDateLabel = (dateStr: string): string => {
  const d = new Date(dateStr + 'T12:00:00')

  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
}

const dateOptions = computed(() => {
  const tz = tenantStore.timezone
  const today = todayInTz(tz)
  const maxDays = reservationSettings.value?.maxAdvanceDays ?? 30
  const schedule = activeSchedule.value
  const options: { label: string; value: string }[] = []

  for (let i = 0; i <= maxDays; i++) {
    const date = addDaysToDateStr(today, i)

    if (schedule) {
      const wh = getScheduleForDate(schedule, date)

      if (wh.dayOff) continue
    }
    options.push({ label: formatDateLabel(date), value: date })
  }

  // При редактировании прошедшая дата может не попасть в список — добавляем её
  if (props.reservation && form.reservedDate && !options.some((o) => o.value === form.reservedDate)) {
    options.unshift({ label: formatDateLabel(form.reservedDate), value: form.reservedDate })
  }

  return options
})

const timeOptions = computed(() => {
  if (!form.reservedDate) return []

  const tz = tenantStore.timezone
  const today = todayInTz(tz)
  const schedule = activeSchedule.value
  const step = reservationSettings.value?.slotStep ?? 30
  const closeBuffer = reservationSettings.value?.closeBufferMinutes ?? 60

  let open = '10:00'
  let close = '22:00'

  if (schedule) {
    const wh = getScheduleForDate(schedule, form.reservedDate)

    if (wh.dayOff) return [{ label: 'Нет доступных слотов', value: null, disabled: true }]
    if (wh.allDay) {
      open = '00:00'
      close = '23:59'
    } else {
      open = wh.open
      close = wh.close
    }
  }

  const rawSlots = generateTimeSlots(open, close, step, closeBuffer)
  const nowMin = form.reservedDate === today ? timeToMinutes(nowTimeInTz(tz)) : null

  const options = rawSlots
    .filter(({ timeStr, nextDay }) => {
      if (nowMin === null) return true

      return timeToMinutes(timeStr) + (nextDay ? 1440 : 0) > nowMin
    })
    .map(({ timeStr }) => ({ label: timeStr, value: timeStr }))

  // При редактировании текущее время может не быть в списке — добавляем его
  if (props.reservation && form.reservedTime && !options.some((o) => o.value === form.reservedTime)) {
    options.unshift({ label: form.reservedTime, value: form.reservedTime })
  }

  if (!options.length) {
    return [{ label: 'Нет доступных слотов', value: null, disabled: true }]
  }

  return options
})

// Сбрасываем стол если при смене количества гостей он перестаёт подходить
watch(() => form.guestCount, () => {
  if (selectedTableId.value) {
    const table = tables.value.find((t) => t.id === selectedTableId.value)

    if (table && table.capacity !== null && table.capacity < form.guestCount) {
      selectedTableId.value = null
    }
  }
})

// Сбрасываем время если после смены даты выбранный слот недоступен
watch(() => form.reservedDate, () => {
  if (form.reservedTime && !timeOptions.value.some((o) => o.value === form.reservedTime)) {
    form.reservedTime = ''
  }
})

// Sync form with reservation prop
watch(() => props.reservation, (r) => {
  if (r) {
    form.guestName = r.guestName
    form.guestPhone = r.guestPhone
    form.reservedDate = r.reservedDate
    form.reservedTime = r.reservedTime
    form.guestCount = r.guestCount
    form.comment = r.comment ?? ''
    selectedTableId.value = r.tableId
  } else {
    form.guestName = ''
    form.guestPhone = ''
    form.reservedDate = ''
    form.reservedTime = ''
    form.guestCount = 2
    form.comment = ''
    selectedTableId.value = props.preselectedTableId ?? null
  }
  cancelReason.value = ''
  showCancelReason.value = false
  isEditing.value = false
}, { immediate: true })

// Брони на выбранную дату (без текущей, только активные) — для ReservationTablePicker
const dayReservations = computed(() => {
  if (!form.reservedDate) return []

  return reservationsStore.reservations.filter((r) => r.reservedDate === form.reservedDate
    && r.id !== props.reservation?.id
    && ['pending', 'confirmed', 'seated'].includes(r.status),
  )
})

const selectedTableIsBooked = computed(() => !!selectedTableId.value && dayReservations.value.some((r) => r.tableId === selectedTableId.value),
)

const isReadOnly = computed(() => {
  if (!props.reservation) return false

  return ['completed', 'cancelled', 'no_show'].includes(props.reservation.status)
})

const drawerActions = computed<DrawerAction[]>(() => {
  const r = props.reservation

  if (!r) {
    return [
      { text: 'Создать', type: 'primary', actionType: 'confirm', loading: saving.value },
      { text: 'Отмена', type: 'default', actionType: 'decline' },
    ]
  }

  if (isReadOnly.value) {
    return [{ text: 'Закрыть', type: 'default', actionType: 'decline' }]
  }

  if (r.status === 'pending') {
    return [
      { text: 'Подтвердить', type: 'primary', actionType: 'confirm', loading: saving.value },
      { text: 'Отменить бронь', type: 'error', actionType: 'decline' },
    ]
  }

  if (r.status === 'confirmed') {
    if (isEditing.value) {
      return [
        { text: 'Сохранить', type: 'primary', actionType: 'confirm', loading: saving.value },
        { text: 'Отмена', type: 'default', actionType: 'decline' },
      ]
    }

    return [
      { text: 'Посадить', type: 'primary', actionType: 'confirm', loading: saving.value },
      { text: 'Отменить бронь', type: 'error', actionType: 'decline' },
    ]
  }

  return [{ text: 'Закрыть', type: 'default', actionType: 'decline' }]
})

const onSave = async () => {
  if (!formRef.value?.validate()) return false

  if (selectedTableIsBooked.value) {
    const ok = await confirm({
      title: 'Стол уже забронирован',
      message: 'На это время есть другая бронь на выбранный стол. Всё равно сохранить?',
      confirmText: 'Да, сохранить',
      confirmType: 'warning',
    })

    if (!ok) return false
  }

  saving.value = true
  try {
    const r = props.reservation

    if (!r) {
      const newTable = selectedTableId.value
        ? tables.value.find((t) => t.id === selectedTableId.value) ?? null
        : null

      await reservationsStore.create({
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        guestCount: form.guestCount,
        reservedDate: form.reservedDate,
        reservedTime: form.reservedTime,
        comment: form.comment || null,
        // Передаём текущий филиал, чтобы бронь попала в список при активном
        // branch_id-фильтре. Без этого INSERT пишет branch_id = null, а list()
        // с eq('branch_id', X) такую запись не вернёт — бронь исчезает сразу
        // после refresh() по событию @saved.
        branchId: branchStore.currentBranchId,
        tableId: newTable?.id ?? null,
        tableName: newTable?.name ?? null,
      })
      success('Бронь создана')
      emit('update:modelValue', false)
      emit('saved')

      return
    }

    if (r.status === 'pending') {
      const confirmedBy = authStore.user?.id ?? ''
      const table = selectedTableId.value ? tables.value.find((t) => t.id === selectedTableId.value) : null

      await reservationsStore.confirm(r.id, selectedTableId.value, table?.name ?? null, confirmedBy)
      success('Бронь подтверждена')
    } else if (r.status === 'confirmed' && isEditing.value) {
      const table = selectedTableId.value ? tables.value.find((t) => t.id === selectedTableId.value) : null

      await reservationsStore.update(r.id, {
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        guestCount: form.guestCount,
        reservedDate: form.reservedDate,
        reservedTime: form.reservedTime,
        comment: form.comment || null,
        tableId: selectedTableId.value,
        tableName: table?.name ?? null,
      })
      success('Бронь обновлена')
    } else if (r.status === 'confirmed') {
      const tz = tenantStore.timezone
      const nowDate = todayInTz(tz)
      const nowTime = nowTimeInTz(tz)
      const toMs = (date: string, time: string) => {
        const [y, mo, d] = date.split('-').map(Number)
        const [h, m] = time.split(':').map(Number)

        return Date.UTC(y, mo - 1, d, h, m)
      }
      const minutesUntil = Math.round((toMs(r.reservedDate, r.reservedTime) - toMs(nowDate, nowTime)) / 60000)

      if (minutesUntil > 0) {
        const hours = Math.floor(minutesUntil / 60)
        const mins = minutesUntil % 60
        const timeLabel = hours > 0
          ? `${hours} ч ${mins > 0 ? `${mins} мин` : ''}`.trim()
          : `${mins} мин`

        const ok = await confirm({
          title: 'Посадить раньше времени?',
          message: `До начала бронирования ещё ${timeLabel}. Вы действительно хотите посадить гостя?`,
          confirmText: 'Посадить',
          confirmType: 'primary',
        })

        if (!ok) return false
      }

      if (selectedTableId.value) {
        const table = tables.value.find((t) => t.id === selectedTableId.value)

        if (!table) {
          error('Стол не найден — обновите страницу')

          return false
        }
        if (table.isOpen) {
          error('Стол уже открыт — выберите другой')

          return false
        }

        // Сначала переводим бронь в seated, затем открываем чек: RPC open_table_check
        // линкует бронь к чеку через UPDATE ... WHERE status='seated' AND order_id IS NULL.
        // Порядок важен — иначе order_id-связь (блок «Бронь» в истории) не проставится.
        await reservationsStore.seat(r.id)

        try {
          await api.tables.openCheck(selectedTableId.value)
        } catch (e) {
          reportError(e, { context: 'reservations:seat:openCheck', tableId: selectedTableId.value, reservationId: r.id })

          // Стол не открылся, но бронь уже в seated — best-effort откатываем её обратно
          // в confirmed, чтобы не осталась осиротевшая seated-бронь без открытого стола.
          // Сбой отката не должен маскировать исходную ошибку — свой try/catch.
          try {
            await reservationsStore.confirm(r.id, table.id, table.name, authStore.user?.id ?? '')
            error('Стол не открылся — бронь возвращена в «подтверждена», повторите открытие')
          } catch (revertErr) {
            reportError(revertErr, { context: 'reservations:seat:openCheck:revert', reservationId: r.id })
            error('Гость отмечен посаженным, но стол не открылся — повторите открытие стола')
          }

          return false
        }

        success('Гость посажен, стол открыт')
      } else {
        await reservationsStore.complete(r.id, new Date().toISOString())
        success('Гость посажен')
      }
    }

    emit('update:modelValue', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}

const onDecline = async () => {
  if (isEditing.value) {
    isEditing.value = false

    return false
  }

  const r = props.reservation

  if (!r || !['pending', 'confirmed'].includes(r.status)) return

  const confirmed = await confirm({
    title: 'Отменить бронь?',
    message: 'Это действие нельзя отменить.',
    confirmText: 'Отменить бронь',
    confirmType: 'error',
  })

  if (!confirmed) return false

  await reservationsStore.cancel(r.id, cancelReason.value || undefined)
  success('Бронь отменена')
  emit('saved')
}

watch(() => props.modelValue, (open) => {
  if (!open) {
    showCancelReason.value = false
    cancelReason.value = ''
    isEditing.value = false
  }
})

const formatDt = (iso: string) => {
  const d = new Date(iso)

  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  padding: var(--space-4) 0;
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
}

.info-grid {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: var(--space-8) var(--space-12);
}
</style>
