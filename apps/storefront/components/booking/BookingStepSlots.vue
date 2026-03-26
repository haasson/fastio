<template>
  <div class="slots-root">
    <p v-if="workingHours && !loading" class="working-hours">
      Работаем {{ workingHours.open }} — {{ workingHours.close }}
    </p>

    <div v-if="loading" class="slots-loading">
      <FsSkeleton :repeat="8" />
    </div>

    <template v-else-if="slots.length">
      <div class="slots-grid">
        <FsButton
          v-for="slot in slots"
          :key="slot.time"
          :variant="form.time === slot.time ? 'primary' : 'secondary'"
          size="medium"
          :disabled="!slot.available"
          @click="onSlotClick(slot.time)"
        >
          {{ slot.time }}
        </FsButton>
      </div>

      <p v-if="timeError" class="time-error">{{ timeError }}</p>

      <FsButton variant="primary" size="large" @click="onNext">
        Продолжить
      </FsButton>
    </template>

    <p v-else class="no-slots">Свободных слотов нет</p>

    <FsButton variant="ghost" size="small" @click="$emit('back')">← Назад</FsButton>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FsButton, FsSkeleton } from '@fastio/public-ui'
import type { WorkingHours } from '@fastio/shared'

type Slot = { time: string; available: boolean }
type BookingForm = { time: string }

const props = defineProps<{
  form: BookingForm
  slots: Slot[]
  loading: boolean
  workingHours?: WorkingHours | null
}>()

const emit = defineEmits<{ next: []; back: [] }>()

const timeError = ref('')

const onSlotClick = (time: string) => {
  props.form.time = time
  timeError.value = ''
}

const onNext = () => {
  if (!props.form.time) {
    timeError.value = 'Выберите время'
    return
  }
  emit('next')
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.slots-root {
  @include flex-col(16px);
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}

.time-error {
  @include text-caption;
  color: var(--color-error, #ef4444);
  margin-top: -8px;
}

.working-hours {
  @include text-caption;
  color: var(--color-text-secondary);
  text-align: center;
  margin-top: -8px;
}

.no-slots {
  @include text-caption;
  color: var(--color-text-secondary);
}

.slots-loading {
  @include flex-col(8px);
}
</style>
