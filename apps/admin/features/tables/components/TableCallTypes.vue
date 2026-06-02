<template>
  <UiCard>
    <UiTitle size="h4" class="section-title">Типы вызовов</UiTitle>
    <UiText size="small" class="section-hint">
      Гость выбирает тип при вызове официанта. Если тип один — выбор не показывается.
    </UiText>

    <div class="tags">
      <span v-for="type in callTypes" :key="type.id" class="tag">
        {{ type.name }}
        <UiChipRemove :size="12" title="Удалить тип" @click="$emit('remove-type', type.id)" />
      </span>

      <div class="tag-add">
        <input
          v-model="newTypeName"
          class="tag-add-input"
          placeholder="Новый тип"
          maxlength="40"
          @keydown.enter="submitNewType"
        />
        <button
          type="button"
          class="tag-add-btn"
          :disabled="!newTypeName.trim()"
          aria-label="Добавить тип"
          @click="submitNewType"
        >
          <UiIcon name="plus" :size="14" />
        </button>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiCard, UiText, UiTitle, UiIcon, UiChipRemove } from '@fastio/ui'
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

.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-8);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) var(--space-4) var(--space-12);
  border-radius: var(--radius-pill);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-title);
}

.tag-add {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  padding-left: var(--space-12);
  border-radius: var(--radius-pill);
  border: 1px dashed var(--color-border);
}

.tag-add-input {
  width: 120px;
  border: none;
  background: transparent;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  padding: var(--space-4) 0;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: var(--color-text-hint);
  }
}

.tag-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--color-primary-soft);
  }

  &:disabled {
    color: var(--color-text-hint);
    cursor: default;
  }
}
</style>
