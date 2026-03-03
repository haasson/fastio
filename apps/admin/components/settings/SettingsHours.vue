<template>
  <form @submit.prevent="handleSave">
    <div class="form">
      <UiText size="tiny" span class="section-title">Часы работы</UiText>

      <div class="days">
        <div v-for="day in days" :key="day.key" class="day-row">
          <span class="day-name">{{ day.label }}</span>

          <UiSwitch
            :model-value="!form[day.key].closed"
            @update:model-value="form[day.key].closed = !$event"
          />

          <template v-if="!form[day.key].closed">
            <input v-model="form[day.key].open" class="time-input" type="time" />
            <span class="dash">—</span>
            <input v-model="form[day.key].close" class="time-input" type="time" />
          </template>
          <span v-else class="closed-label">Выходной</span>
        </div>
      </div>

      <div class="footer">
        <span v-if="saved" class="saved-msg">✅ Сохранено</span>
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiButton, UiSwitch, UiText } from '@fastio/ui'
import type { Tenant, TenantWorkingHours } from '@fastio/shared'
import { workDays } from '~/config/work-days'

type DayKey = keyof TenantWorkingHours

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{ save: [data: Partial<Tenant>] }>()

const days = workDays

const defaultDay = () => ({ open: '09:00', close: '22:00', closed: false })

const form = reactive<TenantWorkingHours>(
  Object.fromEntries(
    days.map(({ key }) => [key, { ...(props.tenant.workingHours?.[key] ?? defaultDay()) }]),
  ) as TenantWorkingHours,
)

watch(() => props.tenant.workingHours, (wh) => {
  if (!wh) return
  days.forEach(({ key }) => {
    Object.assign(form[key], wh[key] ?? defaultDay())
  })
})

const saving = ref(false)
const saved = ref(false)

const handleSave = async () => {
  saving.value = true
  saved.value = false
  try {
    await emit('save', { workingHours: { ...form } })
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 3000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/form' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title {
  @include section-title;
}

.days {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.day-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.day-name {
  width: 28px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-hint);
  flex-shrink: 0;
}

.time-input {
  height: 36px;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
  width: 100px;

  &:focus {
    border-color: var(--color-primary);
  }
}

.dash {
  color: var(--color-text-tertiary);
  font-size: 14px;
}

.closed-label {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.footer {
  @include settings-footer;
}

.saved-msg {
  @include saved-msg;
}
</style>
