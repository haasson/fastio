<template>
  <div class="reservations-root" @click="resetCount">
    <UiTabs v-model="activeTab" :tabs="TABS" prevent-compact />

    <ReservationsActive v-if="activeTab === 'list'" />
    <ReservationsArchive v-else-if="activeTab === 'archive'" />
    <ReservationTimeSettings v-else-if="activeTab === 'settings'" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiTabs } from '@fastio/ui'
import { useNewReservationCounter } from '~/composables/data/useNewReservationCounter'
import ReservationsActive from '~/components/reservations/ReservationsActive.vue'
import ReservationTimeSettings from '~/components/reservations/ReservationTimeSettings.vue'
import ReservationsArchive from '~/components/reservations/ReservationsArchive.vue'

const TABS = [
  { value: 'list', label: 'Активные' },
  { value: 'archive', label: 'Завершённые' },
  { value: 'settings', label: 'Настройки' },
]

const activeTab = ref('list')
const { reset: resetCount } = useNewReservationCounter()

resetCount()
</script>

<style scoped>
.reservations-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
