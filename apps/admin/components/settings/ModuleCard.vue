<template>
  <UiCard size="small" class="module-card" :class="{ locked }">
    <div class="top">
      <div class="icon" :class="{ 'icon--locked': locked }">
        <UiIcon :name="icon" :size="20" />
      </div>
      <div class="meta">
        <UiText size="medium" class="name">{{ name }}</UiText>
        <UiText size="tiny" class="desc">{{ description }}</UiText>
      </div>
    </div>
    <div class="footer">
      <UiTag v-if="locked" type="warning" size="small">С тарифа {{ planLabel }}</UiTag>
      <UiSwitch
        v-else
        :model-value="active"
        :disabled="disabled"
        @update:model-value="$emit('toggle', $event)"
      />
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { UiCard, UiIcon, UiText, UiSwitch, UiTag } from '@fastio/ui'
import type { IconName } from '@fastio/icons'

defineProps<{
  name: string
  description: string
  icon: IconName
  active: boolean
  locked: boolean
  planLabel?: string
  disabled?: boolean
}>()

defineEmits<{ toggle: [value: boolean] }>()
</script>

<style scoped lang="scss">
.module-card {
  gap: var(--space-16);
  border: 1.5px solid var(--color-border-light);

  &.locked {
    opacity: 0.55;
  }
}

.top {
  display: flex;
  align-items: flex-start;
  gap: var(--space-12);
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-8);
  background: var(--color-primary-light);
  color: var(--color-primary);
  flex-shrink: 0;

  &--locked {
    background: var(--color-bg-subtle);
    color: var(--color-text-hint);
  }
}

.meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.name {
  font-weight: var(--font-weight-semibold);
}

.desc {
  color: var(--color-text-hint);
  line-height: var(--line-height-base);
}

.footer {
  display: flex;
  justify-content: flex-end;
}
</style>
