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
          />
        </div>
        <div class="row">
          <UiDatepicker
            v-model="reservedDateTs"
            label="Дата"
            name="reservedDate"
            :disabled="formDisabled"
            :rules="[{ type: 'required', message: 'Укажите дату' }]"
          />
          <UiTimepicker
            v-model="reservedTimeVal"
            label="Время"
            name="reservedTime"
            :disabled="formDisabled"
            :rules="[{ type: 'required', message: 'Укажите время' }]"
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
            v-if="reservation && dineInEnabled"
            v-model:value="selectedTableId"
            label="Стол"
            :options="tableOptions"
            :disabled="formDisabled"
            clearable
            placeholder="Без стола"
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

      <!-- Table availability (pending or confirmed in edit mode) -->
      <template v-if="(reservation?.status === 'pending' || (reservation?.status === 'confirmed' && isEditing)) && tables.length">
        <UiDivider />
        <ReservationTablePicker
          v-model="selectedTableId"
          :tables="tables"
          :day-reservations="dayReservations"
          :guest-count="form.guestCount"
          :reserved-date="form.reservedDate"
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
    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiButton, UiDatepicker, UiDivider, UiDrawer, UiForm, UiInput, UiInputNumber, UiSelect, UiTag, UiText, UiTimepicker, useMessage } from '@fastio/ui'
import type { DrawerAction } from '@fastio/ui'
import type { Reservation, Table } from '@fastio/shared'
import { validationRules, useConfirm } from '@fastio/kit'
import { useReservationsStore } from '~/stores/reservations'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { useAuthStore } from '~/stores/auth'
import { useModules } from '~/composables/plan/useModules'
import { formatDateStr } from '@fastio/shared'
import {
  RESERVATION_STATUS_LABELS as STATUS_LABELS,
  RESERVATION_STATUS_TYPES as STATUS_TYPES,
} from '~/utils/reservation-constants'
import ReservationTablePicker from './ReservationTablePicker.vue'

const props = defineProps<{
  modelValue: boolean
  reservation: Reservation | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const reservationsStore = useReservationsStore()
const tenantStore = useTenantStore()
const authStore = useAuthStore()
const api = useDatabase()
const { success, error } = useMessage()
const { confirm } = useConfirm()
const modules = useModules()
const dineInEnabled = computed(() => modules.dineIn?.value?.enabled ?? false)

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

const tableOptions = computed(() => [
  { label: 'Без стола', value: null },
  ...tables.value.map((t) => ({ label: t.name, value: t.id })),
])

// Load tables for tenant (only when dine-in module is active)
watch([() => tenantStore.currentTenantId, dineInEnabled], async ([id, enabled]) => {
  if (!id || !enabled) {
    tables.value = []

    return
  }
  tables.value = await api.tables.list(id)
}, { immediate: true })

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
    selectedTableId.value = null
  }
  cancelReason.value = ''
  showCancelReason.value = false
  isEditing.value = false
}, { immediate: true })

// Bridge: "YYYY-MM-DD" string ↔ timestamp (UiDatepicker)
const reservedDateTs = computed<number | null>({
  get: () => form.reservedDate ? new Date(form.reservedDate + 'T12:00:00').getTime() : null,
  set: (val) => { form.reservedDate = val ? formatDateStr(val) : '' },
})

// Bridge: string ↔ string | null (UiTimepicker)
const reservedTimeVal = computed<string | null>({
  get: () => form.reservedTime || null,
  set: (val) => { form.reservedTime = val ?? '' },
})

// Брони на выбранную дату (без текущей, только активные) — для ReservationTablePicker
const dayReservations = computed(() => {
  if (!props.reservation) return []

  return reservationsStore.reservations.filter((r) => r.reservedDate === form.reservedDate
    && r.id !== props.reservation!.id
    && ['pending', 'confirmed', 'seated'].includes(r.status),
  )
})

const isReadOnly = computed(() => {
  if (!props.reservation) return false

  return ['completed', 'cancelled', 'no_show'].includes(props.reservation.status)
})

const isToday = computed(() => {
  if (!props.reservation) return false
  const today = new Date().toISOString().slice(0, 10)

  return props.reservation.reservedDate === today
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
      { text: 'Посадить', type: 'primary', actionType: 'confirm', loading: saving.value, disabled: !isToday.value },
      { text: 'Отменить бронь', type: 'error', actionType: 'decline' },
    ]
  }

  return [{ text: 'Закрыть', type: 'default', actionType: 'decline' }]
})

const onSave = async () => {
  if (!formRef.value?.validate()) return false

  saving.value = true
  try {
    const r = props.reservation

    if (!r) {
      await reservationsStore.create({
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        guestCount: form.guestCount,
        reservedDate: form.reservedDate,
        reservedTime: form.reservedTime,
        comment: form.comment || null,
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
      if (!isToday.value) {
        error('Посадить можно только в день брони')

        return false
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
        await api.tables.setOpen(selectedTableId.value, true)
      }
      await reservationsStore.seat(r.id)
      success(selectedTableId.value ? 'Гость посажен, стол открыт' : 'Гость посажен')
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
  gap: 16px;
  padding: 4px 0;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 6px 12px;
}
</style>
