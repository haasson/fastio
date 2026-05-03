<template>
  <div class="settings-root">
    <UiSkeleton v-if="loading" :repeat="4" />

    <UiForm v-else class="form" @submit="save">
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

      <div class="footer">
        <UiButton
          submit
          type="primary"
          :loading="saving"
          :disabled="!isDirty"
        >Сохранить</UiButton>
      </div>
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { UiAlert, UiButton, UiForm, UiInputNumber, UiSelect, UiSkeleton, UiSwitch, useConfirm, useMessage } from '@fastio/ui'
import type { AppointmentSettings, BookingMode } from '@fastio/shared'
import { pluralize } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'
import { useDatabase } from '~/composables/data/useDatabase'
import { useFormDirty } from '~/composables/ui/useFormDirty'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'
import { reportError } from '~/utils/reportError'

const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
const api = useDatabase()
const { success, error } = useMessage()
const { confirm } = useConfirm()
const settingsStore = useAppointmentSettingsStore()

const loading = ref(false)
const saving = ref(false)

const bookingModeOptions: { label: string; value: BookingMode }[] = [
  { label: 'Фикс. длительность', value: 'fixed' },
  { label: 'Произвольная (клиент выбирает)', value: 'variable' },
]

type Form = {
  defaultIsBookable: boolean
  defaultBookingMode: BookingMode
  defaultAllowResourceChoice: boolean
  defaultMaxDuration: number
}

const form = reactive<Form>({
  defaultIsBookable: true,
  defaultBookingMode: 'fixed',
  defaultAllowResourceChoice: true,
  defaultMaxDuration: 180,
})

const { isDirty, reset } = useFormDirty(form)

useUnsavedGuard(isDirty)

const applySettings = (s: AppointmentSettings) => {
  form.defaultIsBookable = s.defaultIsBookable
  form.defaultBookingMode = s.defaultBookingMode
  form.defaultAllowResourceChoice = s.defaultAllowResourceChoice
  form.defaultMaxDuration = s.defaultMaxDuration
  reset()
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
  const tid = currentTenantId.value

  if (!tid) return

  saving.value = true
  try {
    const mismatch = await api.services.countMismatch(tid, {
      isBookable: form.defaultIsBookable,
      bookingMode: form.defaultBookingMode,
      allowResourceChoice: form.defaultAllowResourceChoice,
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

      if (result === null) return
      applyToAll = result
    }

    await api.appointmentSettings.upsert(tid, {
      defaultIsBookable: form.defaultIsBookable,
      defaultBookingMode: form.defaultBookingMode,
      defaultAllowResourceChoice: form.defaultAllowResourceChoice,
      defaultMaxDuration: form.defaultMaxDuration,
    })
    await settingsStore.refresh()

    if (applyToAll) {
      await api.services.bulkPatch(tid, {
        isBookable: form.defaultIsBookable,
        bookingMode: form.defaultBookingMode,
        allowResourceChoice: form.defaultAllowResourceChoice,
      })
    }

    reset()
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

.footer {
  padding-top: var(--space-4);
}
</style>
