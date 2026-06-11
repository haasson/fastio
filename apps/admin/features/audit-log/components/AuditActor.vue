<template>
  <div class="actor">
    <UiText
      span
      size="tiny"
      class="name"
      :class="{ system: !name }"
      data-testid="actor-name"
    >
      {{ name ?? 'Система' }}
    </UiText>
    <UiText
      v-if="name && role"
      span
      size="tiny"
      class="role"
      data-testid="actor-role"
    >
      {{ role }}
    </UiText>
    <!-- email только при живом акторе: у «Системы» почты не бывает -->
    <UiText
      v-if="name && email"
      span
      size="tiny"
      class="email"
      data-testid="actor-email"
    >
      {{ email }}
    </UiText>
  </div>
</template>

<script setup lang="ts">
import { UiText } from '@fastio/ui'

defineProps<{
  name: string | null
  role: string | null
  // live-join auth.users: NULL для системных записей и удалённых юзеров
  email?: string | null
}>()
</script>

<style scoped lang="scss">
.actor {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

// Без обрезки: длинное имя переносится (фидбек юзера — ничего не резать в строку)
.name {
  font-size: var(--font-size-sm);
  color: var(--color-text);

  // Системные записи (триггеры, миграции) — без актёра, приглушаем
  &.system {
    color: var(--color-text-hint);
  }
}

.role {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
}

// Приглушённый email под именем/ролью: помогает различать тёзок.
// word-break — длинные адреса переносятся, колонка узкая (170px).
.email {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
  word-break: break-all;
}
</style>
