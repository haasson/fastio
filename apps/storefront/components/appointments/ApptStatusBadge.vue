<template>
  <FsBadge :variant="variant">{{ label }}</FsBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FsBadge } from '@fastio/public-ui'
import type { AppointmentStatus } from '@fastio/shared'
import { APPOINTMENT_STATUS_LABELS } from '@fastio/shared'

const props = defineProps<{ status: AppointmentStatus }>()

const VARIANTS: Record<AppointmentStatus, 'default' | 'success' | 'warning' | 'error'> = {
  new: 'warning',
  confirmed: 'success',
  done: 'default',
  cancelled: 'error',
}

const label = computed(() => APPOINTMENT_STATUS_LABELS[props.status])
const variant = computed(() => VARIANTS[props.status])
</script>
