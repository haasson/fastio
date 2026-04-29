<template>
  <FsBadge :variant="variant">{{ label }}</FsBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FsBadge } from '@fastio/public-ui'
import type { AppointmentStatus } from '@fastio/shared'

const props = defineProps<{ status: AppointmentStatus }>()

const LABELS: Record<AppointmentStatus, string> = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  done: 'Завершена',
  cancelled: 'Отменена',
}

const VARIANTS: Record<AppointmentStatus, 'default' | 'success' | 'warning' | 'error'> = {
  new: 'warning',
  confirmed: 'success',
  done: 'default',
  cancelled: 'error',
}

const label = computed(() => LABELS[props.status])
const variant = computed(() => VARIANTS[props.status])
</script>
