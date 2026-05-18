<template>
  <FsBadge :variant="variant">{{ label }}</FsBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FsBadge } from '@fastio/public-ui'
import type { ReservationStatus } from '@fastio/shared'
import { RESERVATION_STATUS_LABELS } from '@fastio/shared'

const props = defineProps<{ status: ReservationStatus }>()

const VARIANTS: Record<ReservationStatus, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  confirmed: 'success',
  seated: 'success',
  completed: 'default',
  cancelled: 'error',
  no_show: 'error',
}

const label = computed(() => RESERVATION_STATUS_LABELS[props.status])
const variant = computed(() => VARIANTS[props.status])
</script>
