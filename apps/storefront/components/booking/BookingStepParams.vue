<template>
  <div class="params-root">
    <FsField v-if="branches.length > 1" label="Филиал">
      <div class="branch-cards">
        <FsButton
          v-for="branch in branches"
          :key="branch.id"
          :variant="form.branchId === branch.id ? 'primary' : 'secondary'"
          size="medium"
          @click="form.branchId = branch.id"
        >
          {{ branch.name }}
          <template #sub>{{ branch.address }}</template>
        </FsButton>
      </div>
    </FsField>

    <FsField label="Дата" :error="dateError">
      <div class="dates-scroll">
        <FsButton
          v-for="day in days"
          :key="day.value"
          :variant="form?.date === day.value ? 'primary' : 'secondary'"
          size="medium"
          class="date-btn"
          :disabled="day.isDayOff"
          @click="onDateClick(day.value)"
        >
          {{ day.dayNum }}
          <template #sub>{{ day.month }}</template>
        </FsButton>
      </div>
    </FsField>

    <div class="guests-row">
      <span class="guests-label">Количество гостей</span>
      <SfStepper
        v-model="form.guestCount"
        :min="1"
        :max="maxGuests"
        size="large"
      />
    </div>

    <FsButton variant="primary" size="large" @click="onNext">
      Выбрать время
    </FsButton>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { FsButton, FsField } from '@fastio/public-ui'
import { todayInTz, addDaysToDateStr, getIsoDayForDate, isDayOff as checkDayOff } from '@fastio/shared'
import type { WorkingHoursSchedule } from '@fastio/shared'
import SfStepper from '~/components/sf/domain/SfStepper.vue'

type BookingForm = {
  date: string
  guestCount: number
  branchId: string | null
}

type BookingBranch = { id: string; name: string; address: string | null }

const form = defineModel<BookingForm>('form', { required: true })

const props = defineProps<{
  maxGuests: number
  maxAdvanceDays: number
  branches: BookingBranch[]
  schedule: WorkingHoursSchedule | null
  timezone: string
}>()

const emit = defineEmits<{ next: [] }>()

const dateError = ref('')

const days = computed(() => {
  const result = []
  const todayStr = todayInTz(props.timezone)

  for (let i = 0; i < props.maxAdvanceDays; i++) {
    const value = addDaysToDateStr(todayStr, i)
    const isDayOff = checkDayOff(props.schedule, getIsoDayForDate(value))
    const d = new Date(`${value}T12:00:00Z`)

    result.push({
      value,
      dayNum: d.getUTCDate(),
      month: new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(d),
      isDayOff,
    })
  }

  return result
})

const onDateClick = (value: string) => {
  if (!form.value) return
  form.value.date = value
  dateError.value = ''
}

const onNext = () => {
  if (props.branches.length > 1 && !form.value?.branchId) return
  if (!form.value?.date) {
    dateError.value = 'Выберите дату'
    return
  }
  emit('next')
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.params-root {
  @include flex-col(16px);
}

.branch-cards {
  @include flex-row(8px);
  flex-wrap: wrap;
}

.dates-scroll {
  @include flex-row(8px);
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.date-btn {
  flex-shrink: 0;
}

.guests-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.guests-label {
  font-size: 14px;
  color: var(--color-text);
}
</style>
