<template>
  <div class="tags-root">
    <div class="toolbar">
      <UiButton
        type="primary"
        icon="plus"
        data-tour="add-tag"
        @click="openModal(null)"
      >
        Добавить тег
      </UiButton>
    </div>

    <div data-tour="tags-list">
      <MenuTagList
        :tags="tags"
        :loading="showSkeleton"
        @edit="openModal"
        @delete="confirmDelete"
        @reorder="reorder"
      />
    </div>

    <MenuTagFormModal
      v-model="modalOpen"
      :tenant-id="tenantId"
      :tag="editingItem"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { UiButton } from '@fastio/ui'
import type { DishTagDefinition } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTags } from '../composables/useTags'
import { useItemManager } from '~/shared/ui/composables/useItemManager'
import MenuTagList from './TagList.vue'
import MenuTagFormModal from './TagFormModal.vue'

const { tenantId } = storeToRefs(useTenantStore())

const { tags, loading, load, reorder } = useTags(tenantId)

const { showSkeleton, modalOpen, editingItem, openModal, confirmDelete } = useItemManager<DishTagDefinition>({
  loading,
  remove: async (id: string) => {
    const api = useDatabase()

    await api.tags.remove(id)
    await load()
  },
  confirmTitle: 'Удалить тег?',
})

const onSaved = () => load()
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.tags-root {
  @include flex-col(var(--space-16));
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
