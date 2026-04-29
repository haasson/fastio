<template>
  <div class="settings-root">
    <UiSkeleton v-if="loading" :repeat="4" />

    <UiForm v-else class="form" @submit="save">
      <UiSectionHeader title="Тип ресурсов" />
      <UiSelect
        v-model:value="form.resourceMode"
        label="Что записываем"
        :options="resourceModeOptions"
        message="Сотрудники — мастер, тренер, инструктор. Объекты — солярий, корт, кабинет."
      />

      <template v-if="form.resourceMode !== 'objects'">
        <UiSectionHeader title="Лейбл и формат имени" />
        <div class="row">
          <UiInput
            v-model="form.resourceLabel"
            label="Название исполнителя"
            placeholder="мастер"
            message="Отображается в форме записи на витрине"
          />
          <UiSelect
            v-model:value="form.staffNameFormat"
            label="Формат имени"
            :options="nameFormatOptions"
          />
        </div>
      </template>

      <UiSectionHeader title="Слоты и горизонт" />
      <div class="row">
        <UiSelect
          v-model:value="form.slotStepMinutes"
          label="Шаг слота"
          :options="SLOT_STEP_OPTIONS"
        />
        <UiInputNumber
          v-model="form.bookingHorizonDays"
          label="Дней вперёд (макс.)"
          :min="1"
          :max="365"
          :show-button="true"
        />
      </div>

      <UiSectionHeader title="Подтверждение и отмена" />

      <UiSwitch
        v-model="form.autoConfirm"
        label="Автоподтверждение"
        message="Запись подтверждается сразу без ручного одобрения"
      />

      <div class="row">
        <UiSwitch
          v-model="form.allowClientCancellation"
          label="Клиент может отменить"
          message="Отмена через личный кабинет"
        />
        <UiSwitch
          v-model="form.allowClientReschedule"
          label="Клиент может перенести"
          message="Изменение даты или времени через личный кабинет"
        />
      </div>

      <UiInputNumber
        v-if="form.allowClientCancellation || form.allowClientReschedule"
        v-model="form.cancellationDeadlineHours"
        label="Дедлайн (часов до записи)"
        :min="0"
        :max="72"
        :show-button="true"
        class="deadline-input"
      />

      <div class="footer">
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiForm, UiInput, UiInputNumber, UiSelect, UiSectionHeader, UiSkeleton, UiSwitch, useConfirm, useMessage } from '@fastio/ui'
import { navigateTo } from '#imports'
import type { AppointmentResourceMode, AppointmentSettings, StaffNameFormat } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'

const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
const api = useDatabase()
const { success, error } = useMessage()
const { confirm } = useConfirm()
const settingsStore = useAppointmentSettingsStore()

const loading = ref(false)
const saving = ref(false)

const SLOT_STEP_OPTIONS = [
  { label: '15 мин', value: 15 },
  { label: '30 мин', value: 30 },
  { label: '60 мин', value: 60 },
]

const nameFormatOptions = [
  { label: 'Имя (Анна)', value: 'first_name' },
  { label: 'Имя и инициал (Анна К.)', value: 'first_name_last_initial' },
  { label: 'Полное имя (Анна Краснова)', value: 'full_name' },
]

const resourceModeOptions = [
  { label: 'Только сотрудники', value: 'staff' },
  { label: 'Только объекты', value: 'objects' },
  { label: 'Сотрудники и объекты', value: 'both' },
]

type Form = {
  resourceLabel: string
  resourceMode: AppointmentResourceMode
  staffNameFormat: StaffNameFormat
  autoConfirm: boolean
  bookingHorizonDays: number
  slotStepMinutes: number
  allowClientCancellation: boolean
  allowClientReschedule: boolean
  cancellationDeadlineHours: number
}

const form = reactive<Form>({
  resourceLabel: 'мастер',
  resourceMode: 'staff',
  staffNameFormat: 'first_name',
  autoConfirm: false,
  bookingHorizonDays: 30,
  slotStepMinutes: 30,
  allowClientCancellation: true,
  allowClientReschedule: false,
  cancellationDeadlineHours: 2,
})

const applySettings = (s: AppointmentSettings) => {
  form.resourceLabel = s.resourceLabel
  form.resourceMode = s.resourceMode
  form.staffNameFormat = s.staffNameFormat
  form.autoConfirm = s.autoConfirm
  form.bookingHorizonDays = s.bookingHorizonDays
  form.slotStepMinutes = s.slotStepMinutes
  form.allowClientCancellation = s.allowClientCancellation
  form.allowClientReschedule = s.allowClientReschedule
  form.cancellationDeadlineHours = s.cancellationDeadlineHours
}

const fetch = async () => {
  if (!currentTenantId.value) return
  loading.value = true
  try {
    const s = await api.appointmentSettings.get(currentTenantId.value)

    if (s) applySettings(s)
  } catch (e) {
    reportError(e)
    error('Не удалось загрузить настройки')
  } finally {
    loading.value = false
  }
}

watch(currentTenantId, fetch, { immediate: true })

const save = async () => {
  if (!currentTenantId.value) return

  if (form.resourceMode !== 'both') {
    const counts = await api.resources.countActiveByType(currentTenantId.value)
    const blockedKind = form.resourceMode === 'staff' && counts.object > 0
      ? { count: counts.object, label: 'объектов', target: '/appointments/objects', tab: 'Объекты' }
      : form.resourceMode === 'objects' && counts.person > 0
        ? { count: counts.person, label: 'сотрудников', target: '/appointments/staff', tab: 'Сотрудники' }
        : null

    if (blockedKind) {
      const goNow = await confirm({
        title: 'Нельзя сменить тип ресурсов',
        message: `Активных ${blockedKind.label}: ${blockedKind.count}. Откройте вкладку «${blockedKind.tab}», деактивируйте или удалите их, затем вернитесь сюда.`,
        confirmText: `Перейти к «${blockedKind.tab}»`,
        cancelText: 'Закрыть',
        confirmType: 'primary',
      })

      if (goNow) await navigateTo(blockedKind.target)

      return
    }
  }

  saving.value = true
  try {
    await api.appointmentSettings.upsert(currentTenantId.value, {
      resourceLabel: form.resourceLabel,
      resourceMode: form.resourceMode,
      staffNameFormat: form.staffNameFormat,
      autoConfirm: form.autoConfirm,
      bookingHorizonDays: form.bookingHorizonDays,
      slotStepMinutes: form.slotStepMinutes,
      allowClientCancellation: form.allowClientCancellation,
      allowClientReschedule: form.allowClientReschedule,
      cancellationDeadlineHours: form.cancellationDeadlineHours,
    })
    await settingsStore.refresh()
    success('Настройки сохранены')
  } catch (e) {
    reportError(e)
    error('Не удалось сохранить настройки')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/layout' as *;

.settings-root {
  @include flex-col(var(--space-24));
  max-width: 680px;
}

.form {
  @include modal-form;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
}

.deadline-input {
  max-width: 260px;
}

.footer {
  padding-top: var(--space-4);
}
</style>
