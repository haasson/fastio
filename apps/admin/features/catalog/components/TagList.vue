<template>
  <div class="tag-list-root">
    <UiSkeleton v-if="loading" :height="56" :count="3" />
    <UiEmpty v-else-if="tags.length === 0" icon="hash" text="Тегов пока нет. Создайте первый — он поможет фильтровать позиции." />
    <UiDraggableList v-else v-model="localTags" @reorder="$emit('reorder', localTags)">
      <UiListRow v-for="tag in localTags" :key="tag.id" :name="tag.name">
        <template #name>
          <div class="name-row">
            <span class="preview" :style="previewStyle(tag)">
              <component :is="getIcon(tag.icon)" :size="14" />
            </span>
            <UiText size="small" weight="medium">{{ tag.name }}</UiText>
          </div>
        </template>
        <template #append>
          <UiRowActions @edit="$emit('edit', tag)" @delete="$emit('delete', tag.id)" />
        </template>
      </UiListRow>
    </UiDraggableList>
  </div>
</template>

<script setup lang="ts">
import { UiSkeleton, UiEmpty, UiText, UiListRow, UiDraggableList, UiRowActions } from '@fastio/ui'
import { ref, watch } from 'vue'
import type { DishTagDefinition } from '@fastio/shared'
import { getTagColorPreset } from '@fastio/shared'
import * as icons from 'lucide-vue-next'

const props = defineProps<{
  tags: DishTagDefinition[]
  loading: boolean
}>()

defineEmits<{
  edit: [tag: DishTagDefinition]
  delete: [id: string]
  reorder: [tags: DishTagDefinition[]]
}>()

const localTags = ref<DishTagDefinition[]>([])

watch(() => props.tags, (v) => {
  localTags.value = [...v]
}, { immediate: true })

const previewStyle = (tag: DishTagDefinition) => {
  const preset = getTagColorPreset(tag.color)

  return preset
    ? { color: preset.color, backgroundColor: preset.background }
    : { color: '#475569', backgroundColor: '#f1f5f9' }
}

const getIcon = (name: string) => (icons as Record<string, unknown>)[name] ?? icons.Tag
</script>

<style scoped lang="scss">
.tag-list-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.name-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-8);
  flex-shrink: 0;
}
</style>
