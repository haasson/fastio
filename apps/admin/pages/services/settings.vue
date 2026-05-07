<template>
  <div class="settings-root">
    <UiSkeleton v-if="loading" :repeat="4" />

    <UiForm v-else class="form" @submit.prevent="page.submit">
      <UiAlert type="info">
        Эти настройки применяются автоматически при создании новой услуги. Для каждой услуги их можно изменить отдельно в её настройках.
      </UiAlert>

      <UiSwitch
        v-model="form.defaultIsBookable"
        label="Запись онлайн"
        message="Если включено — новые услуги сразу появляются в форме записи на витрине. Если выключено — услуга создаётся как «только по звонку»."
      />

      <UiSwitch
        v-model="form.defaultAllowResourceChoice"
        label="Клиент выбирает исполнителя"
        message="Если включено — клиент сам выбирает мастера при записи. Если выключено — исполнитель подбирается автоматически по расписанию."
      />

      <UiSelect
        v-model:value="form.defaultBookingMode"
        label="Тип записи"
        :options="bookingModeOptions"
        message="Фикс. длительность — если услуга занимает известное время: массаж 60 мин, стрижка 45 мин. Произвольная — клиент выбирает длительность сам: аренда оборудования, корта, кабинета."
      />

      <UiInputNumber
        v-if="form.defaultBookingMode === 'variable'"
        v-model="form.defaultMaxDuration"
        label="Максимальная длительность по умолчанию, мин"
        :min="30"
        :max="1440"
        :show-button="true"
        message="Применяется ко всем услугам с произвольной длительностью, у которых не задан индивидуальный максимум"
      />
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { UiAlert, UiForm, UiInputNumber, UiSelect, UiSkeleton, UiSwitch, useConfirm } from '@fastio/ui'
import type { BookingMode } from '@fastio/shared'
import { pluralize } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useAppointmentSettingsStore } from '~/stores/services/appointmentSettings'
import { useDatabase } from '~/composables/data/useDatabase'
import { useEditableForm, cancelSubmit } from '~/composables/ui/useEditableForm'
import { useRegisterPageForm } from '~/composables/ui/usePageForm'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'

const tenantStore = useTenantStore()
const api = useDatabase()
const { confirm } = useConfirm()
const settingsStore = useAppointmentSettingsStore()
const { settings, loading } = storeToRefs(settingsStore)

const bookingModeOptions: { label: string; value: BookingMode }[] = [
  { label: 'Фикс. длительность', value: 'fixed' },
  { label: 'Произвольная (клиент выбирает)', value: 'variable' },
]

const page = useEditableForm({
  source: settings,
  build: (s) => ({
    defaultIsBookable: s?.defaultIsBookable ?? true,
    defaultBookingMode: (s?.defaultBookingMode ?? 'fixed') as BookingMode,
    defaultAllowResourceChoice: s?.defaultAllowResourceChoice ?? true,
    defaultMaxDuration: s?.defaultMaxDuration ?? 180,
  }),
  errorMessage: 'Не удалось сохранить настройки',
  save: async (data) => {
    const tid = tenantStore.currentTenantId

    if (!tid) return

    const mismatch = await api.services.countMismatch(tid, {
      isBookable: data.defaultIsBookable,
      bookingMode: data.defaultBookingMode,
      allowResourceChoice: data.defaultAllowResourceChoice,
    })

    let applyToAll = false

    if (mismatch > 0) {
      const label = `${mismatch} ${pluralize(mismatch, 'услуга', 'услуги', 'услуг')}`
      const result = await confirm({
        title: 'Применить к существующим услугам?',
        message: `${label} ${pluralize(mismatch, 'создана', 'созданы', 'созданы')} с другими настройками — «Запись онлайн», «Выбор исполнителя» или «Тип записи» у ${pluralize(mismatch, 'неё', 'них', 'них')} отличаются от новых дефолтов.\n\n«Применить ко всем» обновит их прямо сейчас. «Только для новых» сохранит дефолты только для услуг, которые создадите в будущем.`,
        alert: 'Массовое обновление нельзя отменить — после этого настройки у затронутых услуг изменятся.',
        confirmText: 'Применить ко всем',
        cancelText: 'Только для новых',
        confirmType: 'primary',
        stackedActions: true,
      })

      // Юзер закрыл confirm — отменяем сабмит без error-тоста и без сброса dirty.
      if (result === null) throw cancelSubmit()
      applyToAll = result
    }

    await api.appointmentSettings.upsert(tid, data)
    await settingsStore.refresh()

    if (applyToAll) {
      await api.services.bulkPatch(tid, {
        isBookable: data.defaultIsBookable,
        bookingMode: data.defaultBookingMode,
        allowResourceChoice: data.defaultAllowResourceChoice,
      })
    }
  },
  successMessage: 'Настройки сохранены',
})

const { form } = page

useRegisterPageForm(page)
useUnsavedGuard(page.isDirty)
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
</style>
