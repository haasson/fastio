<template>
  <div v-if="show" class="partial-init-banner">
    <UiIcon name="warningRound" :size="18" />
    <span>
      Часть данных не загрузилась ({{ failuresList }}). Обновите страницу — если ошибка повторится, напишите в поддержку.
    </span>
    <UiButton
      type="text"
      size="small"
      class="banner-btn"
      @click="reload"
    >
      Обновить
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiIcon } from '@fastio/ui'
import { useTenantStore } from '~/shared/stores/tenant'

const { partialInitFailures } = storeToRefs(useTenantStore())

const show = computed(() => partialInitFailures.value.length > 0)

// Метки человекочитаемые — для slot-имён из useTenant.init()
const SLOT_LABELS: Record<string, string> = {
  plans: 'тарифы',
  configs: 'настройки модулей',
  roles: 'роли',
}

const failuresList = computed(() => partialInitFailures.value
  .map((slot) => SLOT_LABELS[slot] ?? slot)
  .join(', '))

const reload = () => {
  window.location.reload()
}
</script>

<style scoped lang="scss">
.partial-init-banner {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-24);
  background: var(--color-warning-light);
  color: var(--color-text);
  font-size: var(--font-size-md);
  border-bottom: 1px solid var(--color-warning);
}

.banner-btn {
  margin-left: auto;
  white-space: nowrap;
}
</style>
