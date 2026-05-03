<template>
  <div class="settings-root">
    <AppStorefrontAlert feature-key="booking" />
    <UiAlert v-if="!hasSchedule" type="warning">
      Расписание работы не настроено — перейди в
      <a href="/branches">«Заведение»</a>
      и заполни часы работы по дням.
    </UiAlert>

    <UiForm class="form" @submit="handleSave">
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

      <div class="footer">
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiAlert, UiButton, UiForm, UiInputNumber, UiSectionHeader, UiSelect, UiSwitch, useMessage } from '@fastio/ui'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { useGate } from '~/composables/plan/useGate'
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
const { success } = useMessage()

const saving = ref(false)
const form = reactive({
  slotStep: 30,
  maxAdvanceDays: 30,
  closeBufferMinutes: 60,
  maxGuests: 20,
  maxGuestsAuto: false,
})

const hasSchedule = computed(() => !!tenantStore.tenant.workingHoursSchedule)
const hasDineIn = computed(() => gate.dineIn.value.enabled)

watch(() => tenantStore.currentTenantId, async (id) => {
  if (!id) return
  const data = await api.reservationSettings.get(id)

  if (data) {
    form.slotStep = data.slotStep
    form.maxAdvanceDays = data.maxAdvanceDays
    form.closeBufferMinutes = data.closeBufferMinutes
    form.maxGuests = data.maxGuests
    form.maxGuestsAuto = data.maxGuestsAuto
  }
}, { immediate: true })

const handleSave = async () => {
  const tenantId = tenantStore.currentTenantId

  if (!tenantId) return

  saving.value = true
  try {
    await api.reservationSettings.upsert(tenantId, { ...form })
    success('Настройки сохранены')
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

.buffer-select {
  max-width: 260px;
}

.guests-row {
  @include flex-row(var(--space-20));
  align-items: flex-end;
}

.footer {
  padding-top: var(--space-4);
}
</style>
