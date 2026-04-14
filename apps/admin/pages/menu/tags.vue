<template>
  <div class="tags-root">
    <div class="toolbar">
      <UiButton type="primary" icon="plus" @click="openModal(null)">
        Добавить тег
      </UiButton>
    </div>

    <MenuTagList
      :tags="tags"
      :loading="showSkeleton"
      @edit="openModal"
      @delete="confirmDelete"
      @reorder="reorder"
    />

    <MenuTagFormModal
      v-model="modalOpen"
      :tenant-id="tenantId"
      :tag="editingItem"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiButton } from '@fastio/ui'
import type { DishTagDefinition } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTags } from '~/composables/data/useTags'
import { useItemManager } from '~/composables/ui/useItemManager'
import MenuTagList from '~/components/menu/TagList.vue'
import MenuTagFormModal from '~/components/menu/TagFormModal.vue'

const tenantStore = useTenantStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')

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
.tags-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
