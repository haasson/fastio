<template>
  <div class="params-root">
    <FsField label="Дата" :error="dateError">
      <div class="dates-scroll">
        <FsButton
          v-for="day in days"
          :key="day.value"
          :variant="form.date === day.value ? 'primary' : 'secondary'"
          size="medium"
          class="date-btn"
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
import { formatDateStr } from '@fastio/shared'
import SfStepper from '~/components/sf/domain/SfStepper.vue'

type BookingForm = {
  date: string
  guestCount: number
  branchId: string | null
}

const props = defineProps<{
  form: BookingForm
  maxGuests: number
  maxAdvanceDays: number
}>()

const emit = defineEmits<{ next: [] }>()

const dateError = ref('')

const days = computed(() => {
  const result = []
  const today = new Date()

  for (let i = 0; i < props.maxAdvanceDays; i++) {
    const d = new Date(today)

    d.setDate(today.getDate() + i)

    const value = formatDateStr(d.getTime())

    result.push({
      value,
      dayNum: d.getDate(),
      month: d.toLocaleString('ru-RU', { day: 'numeric', month: 'long' }).replace(/^\d+\s/, ''),
    })
  }

  return result
})

const onDateClick = (value: string) => {
  props.form.date = value
  dateError.value = ''
}

const onNext = () => {
  if (!props.form.date) {
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
