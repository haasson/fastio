<template>
  <form class="form" @submit.prevent="handleSave">
    <h3 class="section-title">Часы работы</h3>

    <div class="days">
      <div v-for="day in days" :key="day.key" class="day-row">
        <span class="day-name">{{ day.label }}</span>
        <AppToggle
          :model-value="!form[day.key].closed"
          @update:model-value="form[day.key].closed = !$event"
        />
        <template v-if="!form[day.key].closed">
          <input
            v-model="form[day.key].open"
            class="time-input"
            type="time"
          />
          <span class="dash">—</span>
          <input
            v-model="form[day.key].close"
            class="time-input"
            type="time"
          />
        </template>
        <span v-else class="closed-label">Выходной</span>
      </div>
    </div>

    <div class="footer">
      <span v-if="saved" class="saved-msg">✅ Сохранено</span>
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { Tenant, TenantWorkingHours } from '@fastfood-saas/shared'

type DayKey = keyof TenantWorkingHours

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{ save: [data: Partial<Tenant>] }>()

const days: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Пн' },
  { key: 'tue', label: 'Вт' },
  { key: 'wed', label: 'Ср' },
  { key: 'thu', label: 'Чт' },
  { key: 'fri', label: 'Пт' },
  { key: 'sat', label: 'Сб' },
  { key: 'sun', label: 'Вс' },
]

const defaultDay = () => ({ open: '09:00', close: '22:00', closed: false })

const form = reactive<TenantWorkingHours>(
  Object.fromEntries(
    days.map(({ key }) => [key, { ...(props.tenant.workingHours?.[key] ?? defaultDay()) }])
  ) as TenantWorkingHours
)

watch(() => props.tenant.workingHours, (wh) => {
  if (!wh) return
  days.forEach(({ key }) => { Object.assign(form[key], wh[key] ?? defaultDay()) })
})

const saving = ref(false)
const saved = ref(false)

async function handleSave() {
  saving.value = true
  saved.value = false
  try {
    await emit('save', { workingHours: { ...form } })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 20px; }

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
}

.days { display: flex; flex-direction: column; gap: 10px; }

.day-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.day-name {
  width: 28px;
  font-size: 13px;
  font-weight: 700;
  color: #555;
  flex-shrink: 0;
}

.time-input {
  height: 36px;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  width: 100px;
}

.time-input:focus { border-color: #ff6b35; }

.dash { color: #ccc; font-size: 14px; }

.closed-label {
  font-size: 13px;
  color: #bbb;
  margin-left: 4px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.saved-msg { font-size: 13px; color: #10b981; }

.btn-primary {
  height: 40px;
  padding: 0 20px;
  background: #ff6b35;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-primary:hover:not(:disabled) { background: #e55a25; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
