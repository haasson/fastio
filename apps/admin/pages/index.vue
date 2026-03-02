<template>
  <div class="dashboard-root">
    <h2 class="heading">Дашборд</h2>
    <!-- TODO: статистика заказов, выручка, последние заказы -->
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>

<style scoped lang="scss">
.heading {
  font-size: 24px;
  font-weight: 700;
  color: #111;
  margin-bottom: 24px;
}
</style>
