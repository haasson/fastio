<template>
  <!-- @click сбрасывает счётчик новых броней при любом взаимодействии со страницей -->
  <div class="reservations-root" @click="resetCount">
    <TabsLayout :tabs="tabs" base-path="/reservations" />
  </div>
</template>

<script setup lang="ts">
import { useNewReservationCounter } from '~/composables/data/useNewReservationCounter'
import TabsLayout from '~/components/ui/TabsLayout.vue'

const { reset: resetCount } = useNewReservationCounter()

// Сбрасываем при входе на страницу — считаем, что пользователь уже видит брони
resetCount()

const tabs = [
  { value: 'list', label: 'Активные' },
  { value: 'archive', label: 'Завершённые' },
  { value: 'settings', label: 'Настройки' },
]
</script>

<style scoped lang="scss">
.reservations-root {
  display: contents;
}
</style>
