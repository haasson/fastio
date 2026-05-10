<template>
  <div class="settings-root">
    <AppStorefrontAlert feature-key="booking" />
    <UiAlert v-if="!hasSchedule" type="warning">
      Расписание работы не настроено — перейди в
      <a href="/branches">«Заведение»</a>
      и заполни часы работы по дням.
    </UiAlert>

    <UiForm class="form" @submit.prevent="page.submit">
      <UiSectionHeader title="Слоты и доступность" />
      <div class="row">
        <UiSelect
          v-model:value="form.slotStep"
          label="Шаг слотов"
          :options="SLOT_STEP_OPTIONS"
        />
        <UiInputNumber
          v-model:value="form.maxAdvanceDays"
          label="Дней вперёд (макс.)"
          :min="1"
          :max="365"
          :show-button="true"
        />
      </div>

      <UiSectionHeader
        title="Последнее бронирование"
        description="За сколько минут до закрытия принимается последняя бронь"
      />
      <UiSelect
        v-model:value="form.closeBufferMinutes"
        label="Буфер до закрытия"
        :options="BUFFER_OPTIONS"
        class="buffer-select"
      />

      <UiSectionHeader title="Количество гостей" />
      <div class="guests-row">
        <UiInputNumber
          v-model:value="form.maxGuests"
          label="Максимум гостей"
          :min="1"
          :max="500"
          :show-button="true"
          :disabled="form.maxGuestsAuto && hasDineIn"
        />
        <UiSwitch
          v-if="hasDineIn"
          v-model:value="form.maxGuestsAuto"
          label="Авто: брать вместимость самого большого стола"
        />
      </div>
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiAlert, UiForm, UiInputNumber, UiSectionHeader, UiSelect, UiSwitch } from '@fastio/ui'
import type { ReservationSettings } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { useGate } from '~/composables/plan/useGate'
import { useEditableForm } from '~/composables/ui/useEditableForm'
import { useRegisterPageForm } from '~/composables/ui/usePageForm'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'
import AppStorefrontAlert from '~/components/ui/AppStorefrontAlert.vue'

const SLOT_STEP_OPTIONS = [
  { label: '15 мин', value: 15 },
  { label: '30 мин', value: 30 },
  { label: '60 мин', value: 60 },
]

const BUFFER_OPTIONS = [
  { label: '30 минут', value: 30 },
  { label: '1 час', value: 60 },
  { label: '1.5 часа', value: 90 },
  { label: '2 часа', value: 120 },
  { label: '3 часа', value: 180 },
]

const tenantStore = useTenantStore()
const gate = useGate()
const api = useDatabase()

const source = ref<ReservationSettings | null>(null)

// Смена тенанта = hard reload страницы (см. tenantStore.setCurrent), поэтому fetch один раз на mount.
onMounted(async () => {
  const id = tenantStore.currentTenantId

  if (!id) return
  source.value = await api.reservationSettings.get(id)
})

const page = useEditableForm({
  source,
  build: (s) => ({
    slotStep: s?.slotStep ?? 30,
    maxAdvanceDays: s?.maxAdvanceDays ?? 30,
    closeBufferMinutes: s?.closeBufferMinutes ?? 60,
    maxGuests: s?.maxGuests ?? 20,
    maxGuestsAuto: s?.maxGuestsAuto ?? false,
  }),
  save: async (data) => {
    const tenantId = tenantStore.currentTenantId

    if (!tenantId) return
    source.value = await api.reservationSettings.upsert(tenantId, { ...data })
  },
  successMessage: 'Настройки сохранены',
})

const { form } = page

useRegisterPageForm(page)
useUnsavedGuard(page.isDirty)

const hasSchedule = computed(() => !!tenantStore.tenant.workingHoursSchedule)
const hasDineIn = computed(() => gate.dineIn.value.enabled)
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

.buffer-select {
  max-width: 260px;
}

.guests-row {
  @include flex-row(var(--space-20));
  align-items: flex-end;
}
</style>
