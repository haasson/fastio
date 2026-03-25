<template>
  <span v-if="pageKey === 'menu'" class="coming-soon">Настройки страницы меню появятся в ближайшее время</span>
  <span v-else-if="pageKey === 'gallery'" class="coming-soon">Настройки страницы галереи появятся в ближайшее время</span>
  <span v-else-if="pageKey === 'delivery'" class="coming-soon">Настройки страницы доставки появятся в ближайшее время</span>
  <span v-else-if="pageKey === 'vacancies'" class="coming-soon">Настройки страницы вакансий появятся в ближайшее время</span>
  <span v-else-if="pageKey === 'booking'" class="coming-soon">Настройки страницы бронирования появятся в ближайшее время</span>
  <span v-else-if="pageKey === 'about'" class="coming-soon">Настройки страницы «О нас» появятся в ближайшее время</span>
</template>

<script setup lang="ts">
import type { PageKey } from '@fastio/shared'

defineProps<{
  pageKey: PageKey
}>()
</script>

<style scoped lang="scss">
.coming-soon {
  font-size: 13px;
  color: var(--color-text-tertiary);
}
</style>
