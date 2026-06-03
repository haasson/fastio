<template>
  <div class="settings-root">
    <UiSkeleton v-if="loading" :repeat="4" />

    <UiForm v-else class="form" @submit.prevent="page.submit">
      <UiFormSection title="Тип ресурсов" :columns="1">
        <UiSelect
          v-model:value="form.resourceMode"
          label="Что записываем"
          :options="resourceModeOptions"
          help="Сотрудники — мастер, тренер, инструктор. Объекты — солярий, корт, кабинет."
        />
      </UiFormSection>

      <UiFormSection
        v-if="form.resourceMode !== 'objects'"
        title="Лейбл и формат имени"
      >
        <UiInput
          v-model="form.resourceLabel"
          label="Название исполнителя"
          placeholder="мастер"
          help="Отображается в форме записи на витрине"
        />
        <UiSelect
          v-model:value="form.staffNameFormat"
          label="Формат имени"
          :options="nameFormatOptions"
        />
      </UiFormSection>

      <UiFormSection title="Слоты и горизонт">
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
      </UiFormSection>

      <UiFormSection title="Подтверждение и отмена" :columns="1">
        <UiSettingRow
          label="Автоподтверждение"
          help="Запись подтверждается сразу без ручного одобрения"
        >
          <UiSwitch v-model="form.autoConfirm" />
        </UiSettingRow>

        <UiSettingRow
          label="Клиент может отменить"
          help="Отмена через личный кабинет"
        >
          <UiSwitch v-model="form.allowClientCancellation" />
        </UiSettingRow>

        <UiSettingRow
          label="Клиент может перенести"
          help="Изменение даты или времени через личный кабинет"
        >
          <UiSwitch v-model="form.allowClientReschedule" />
        </UiSettingRow>

        <UiInputNumber
          v-if="form.allowClientCancellation || form.allowClientReschedule"
          v-model="form.cancellationDeadlineHours"
          label="Дедлайн (часов до записи)"
          :min="0"
          :max="72"
          :show-button="true"
        />
      </UiFormSection>
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { UiForm, UiFormSection, UiInput, UiInputNumber, UiSelect, UiSettingRow, UiSkeleton, UiSwitch, useConfirm } from '@fastio/ui'
import { navigateTo } from '#imports'
import type { AppointmentResourceMode, StaffNameFormat } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAppointmentSettingsStore } from '~/features/appointments'
import { useDatabase } from '~/shared/data/useDatabase'
import { useEditableForm, cancelSubmit } from '~/shared/ui/composables/useEditableForm'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'

const tenantStore = useTenantStore()
const api = useDatabase()
const { confirm } = useConfirm()
const settingsStore = useAppointmentSettingsStore()
const { settings, loading } = storeToRefs(settingsStore)

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

const page = useEditableForm({
  source: settings,
  build: (s): Form => ({
    resourceLabel: s?.resourceLabel ?? 'мастер',
    resourceMode: s?.resourceMode ?? 'staff',
    staffNameFormat: s?.staffNameFormat ?? 'first_name',
    autoConfirm: s?.autoConfirm ?? false,
    bookingHorizonDays: s?.bookingHorizonDays ?? 30,
    slotStepMinutes: s?.slotStepMinutes ?? 30,
    allowClientCancellation: s?.allowClientCancellation ?? true,
    allowClientReschedule: s?.allowClientReschedule ?? false,
    cancellationDeadlineHours: s?.cancellationDeadlineHours ?? 2,
  }),
  errorMessage: 'Не удалось сохранить настройки',
  save: async (data) => {
    const tid = tenantStore.currentTenantId

    if (!tid) return

    if (data.resourceMode !== 'both') {
      const counts = await api.resources.countActiveByType(tid)
      const blockedKind = data.resourceMode === 'staff' && counts.object > 0
        ? { count: counts.object, label: 'объектов', target: '/appointments/objects', tab: 'Объекты' }
        : data.resourceMode === 'objects' && counts.person > 0
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
        throw cancelSubmit()
      }
    }

    await api.appointmentSettings.upsert(tid, data)
    await settingsStore.refresh()
  },
  successMessage: 'Настройки сохранены',
})

const { form } = page

useRegisterPageForm(page)
useUnsavedGuard(page.isDirty)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.settings-root {
  max-width: 720px;
}

.form {
  @include flex-col(var(--space-12));
}
</style>
