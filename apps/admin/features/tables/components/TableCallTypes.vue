<template>
  <UiCard>
    <UiTitle size="h4" class="section-title">Типы вызовов</UiTitle>
    <UiText size="small" class="section-hint">
      Гость выбирает тип при вызове официанта. Если тип один — выбор не показывается.
    </UiText>

    <div v-if="callTypes.length" class="type-list">
      <div v-for="type in callTypes" :key="type.id" class="type-item">
        <UiText size="small" class="type-name">{{ type.name }}</UiText>
        <UiButton
          size="small"
          type="text"
          icon="trash"
          aria-label="Удалить тип"
          @click="$emit('remove-type', type.id)"
        />
      </div>
    </div>

    <UiDivider v-if="callTypes.length" />

    <div class="type-add">
      <UiInput
        v-model:value="newTypeName"
        placeholder="Название типа вызова"
        class="type-input"
        @keydown.enter="submitNewType"
      />
      <UiButton
        type="primary"
        icon="plus"
        :disabled="!newTypeName.trim()"
        @click="submitNewType"
      >
        Добавить
      </UiButton>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiCard, UiButton, UiInput, UiText, UiTitle, UiDivider } from '@fastio/ui'
import type { TableCallType } from '@fastio/shared'

defineProps<{
  callTypes: TableCallType[]
}>()

const emit = defineEmits<{
  'add-type': [name: string]
  'remove-type': [id: string]
}>()

const newTypeName = ref('')

const submitNewType = () => {
  const name = newTypeName.value.trim()

  if (!name) return
  emit('add-type', name)
  newTypeName.value = ''
}
</script>

<style scoped lang="scss">
.section-title {
  margin-bottom: var(--space-4);
}

.section-hint {
  display: block;
  color: var(--color-text-hint);
  margin-bottom: var(--space-12);
}

.type-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.type-item {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-8) 0;
}

.type-name {
  flex: 1;
}

.type-add {
  display: flex;
  gap: var(--space-8);
  align-items: flex-start;
}

.type-input {
  flex: 1;
}
</style>
