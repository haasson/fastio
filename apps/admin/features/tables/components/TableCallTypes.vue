<template>
  <div class="call-types">
    <div class="ct-head">
      <span class="field-caption">Типы вызовов</span>
      <UiInfoTip content="Гость выбирает тип при вызове официанта. Если тип один — выбор не показывается." />
    </div>

    <div class="tags">
      <UiTag
        v-for="type in callTypes"
        :key="type.id"
        closable
        @close="$emit('remove-type', type.id)"
      >
        {{ type.name }}
      </UiTag>

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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiIcon, UiTag, UiInfoTip } from '@fastio/ui'
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
@use '@fastio/styles/mixins/layout' as *;

.call-types {
  @include flex-col(var(--space-8));
}

.ct-head {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}

// Лейбл поля-группы — как у остальных полей формы (12px).
.field-caption {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-8);
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
