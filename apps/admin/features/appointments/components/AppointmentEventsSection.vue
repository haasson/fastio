<template>
  <AppointmentEventTimeline :events="events" :timezone="tz" :loading="loading" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import { useAppointmentEvents } from '~/features/appointments/composables/useAppointmentEvents'
import AppointmentEventTimeline from '~/features/appointments/components/AppointmentEventTimeline.vue'

const props = defineProps<{
  appointmentId: string
  refreshKey?: number
}>()

const tenantStore = useTenantStore()
const tz = computed(() => tenantStore.tenant.timezone)
const { events, loading, refresh } = useAppointmentEvents(computed(() => props.appointmentId))

watch(() => props.refreshKey, () => refresh())
</script>
