<template>
  <AppointmentEventTimeline :events="events" :timezone="tz" :loading="loading" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import { useAppointmentEvents } from '~/composables/data/useAppointmentEvents'
import AppointmentEventTimeline from '~/components/appointments/AppointmentEventTimeline.vue'

const props = defineProps<{
  appointmentId: string
  refreshKey?: number
}>()

const tenantStore = useTenantStore()
const tz = computed(() => tenantStore.tenant.timezone)
const { events, loading, refresh } = useAppointmentEvents(computed(() => props.appointmentId))

watch(() => props.refreshKey, () => refresh())
</script>
