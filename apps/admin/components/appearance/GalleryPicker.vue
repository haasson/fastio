<template>
  <div class="picker-root">
    <UiSelect
      label="Добавить галерею"
      :value="null"
      :options="availableOptions"
      placeholder="Выберите галерею..."
      clearable
      @update:value="onSelect"
    />

    <div v-if="selectedGalleries.length" class="selected-list">
      <VueDraggable
        v-model="orderedIds"
        handle=".drag-handle"
        :animation="160"
        ghost-class="item-ghost"
        @end="onReorder"
      >
        <div v-for="gallery in selectedGalleries" :key="gallery.id" class="selected-item">
          <span class="drag-handle">
            <UiIcon name="grip" :size="12" />
          </span>
          <span class="item-name">{{ gallery.name }}</span>
          <button type="button" class="remove-btn" @click="onRemove(gallery.id)">
            <UiIcon name="close" :size="12" />
          </button>
        </div>
      </VueDraggable>
    </div>

    <span v-if="loading" class="hint">Загрузка галерей...</span>
    <span v-else-if="galleries.length === 0" class="hint">
      Галереи не созданы. Перейдите в
      <RouterLink to="/content/gallery" class="link">Контент → Галерея</RouterLink>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { UiSelect, UiIcon } from '@fastio/ui'
import type { Gallery } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'

const props = defineProps<{
  galleryIds: string[]
}>()

const emit = defineEmits<{
  'update:galleryIds': [ids: string[]]
}>()

const api = useDatabase()
const tenantStore = useTenantStore()
const galleries = ref<Gallery[]>([])
const loading = ref(false)

onMounted(async () => {
  const tenantId = tenantStore.tenant?.id

  if (!tenantId) return
  loading.value = true
  try {
    galleries.value = await api.galleries.list(tenantId)
  } finally {
    loading.value = false
  }
})

const orderedIds = computed({
  get: () => props.galleryIds,
  set: (val) => emit('update:galleryIds', val),
})

const selectedGalleries = computed(() => props.galleryIds
  .map((id) => galleries.value.find((g) => g.id === id))
  .filter((g): g is Gallery => !!g),
)

const availableOptions = computed(() => galleries.value
  .filter((g) => !props.galleryIds.includes(g.id))
  .map((g) => ({ label: g.name, value: g.id })),
)

const onSelect = (id: string | null) => {
  if (!id) return
  emit('update:galleryIds', [...props.galleryIds, id])
}

const onRemove = (id: string) => {
  emit('update:galleryIds', props.galleryIds.filter((i) => i !== id))
}

const onReorder = () => {
  emit('update:galleryIds', orderedIds.value)
}
</script>

<style scoped lang="scss">
.picker-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.selected-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.drag-handle {
  cursor: grab;
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  flex-shrink: 0;

  &:active { cursor: grabbing; }
}

.item-name {
  flex: 1;
  font-size: 12px;
  color: var(--color-text);
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-tertiary);
  padding: 2px;
  border-radius: 3px;
  flex-shrink: 0;
  transition: color 0.15s;

  &:hover { color: var(--color-text); }
}

.hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.link {
  color: var(--color-primary);
  text-decoration: none;

  &:hover { text-decoration: underline; }
}

:deep(.item-ghost) {
  opacity: 0.4;
}
</style>
