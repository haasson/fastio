<template>
  <main class="combos-root">
    <UiSectionHeader title="Комбо">
      <template #right>
        <UiButton
          size="medium"
          type="primary"
          icon="plus"
          @click="openComboModal(null)"
        >Добавить комбо</UiButton>
      </template>
    </UiSectionHeader>

    <div class="grid-wrap">
      <UiSkeleton v-if="showSkeleton" text :repeat="4" />

      <template v-else>
        <UiAppEmpty v-if="combos.length === 0" icon="dishes" text="В этой категории пока нет комбо" />

        <VueDraggable
          v-else
          v-model="combos"
          class="cards-grid"
          :animation="180"
          ghost-class="card-ghost"
          @end="reorderCombos"
        >
          <UiCard
            v-for="combo in combos"
            :key="combo.id"
            size="small"
            class="combo-card"
            :class="{ inactive: !combo.active }"
          >
            <UiSpace :size="8" vertical>
              <div class="card-photo">
                <img v-if="combo.photos[0]" :src="combo.photos[0]" :alt="combo.name" />
                <UiPhotoPlaceholder v-else size="medium" />
              </div>

              <span class="combo-name">{{ combo.name }}</span>

              <UiSpace :size="4" align="center">
                <span class="combo-price">{{ formatPrice(combo.price) }}</span>
                <UiTag v-for="tag in combo.tags" :key="tag" size="tiny">{{ tagOptions[tag] }}</UiTag>
              </UiSpace>

              <div class="card-actions">
                <UiSwitch
                  :model-value="combo.active"
                  @update:model-value="toggleActive(combo.id, $event)"
                />
                <div class="card-btns">
                  <UiButton
                    type="text"
                    size="medium"
                    icon="pencil"
                    title="Редактировать"
                    @click="openComboModal(combo)"
                  />
                  <UiButton
                    type="text"
                    size="medium"
                    icon="trash"
                    title="Удалить"
                    @click="confirmDeleteCombo(combo.id)"
                  />
                </div>
              </div>
            </UiSpace>
          </UiCard>
        </VueDraggable>
      </template>
    </div>

    <MenuComboFormModal
      v-model="comboModalOpen"
      :tenant-id="tenantId"
      :categories="categories"
      :combo="editingCombo"
      :add-combo="addCombo"
      :update-combo="updateCombo"
      @saved="closeComboModal"
    />
  </main>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiButton, UiSkeleton, UiSpace, UiTag, UiCard, UiSwitch, UiPhotoPlaceholder } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import type { Combo, Category } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import UiAppEmpty from '~/components/ui/AppEmpty.vue'
import MenuComboFormModal from '~/components/menu/ComboFormModal.vue'
import { useCombos } from '~/composables/data/useCombos'
import useDelayedLoading from '~/composables/ui/useDelayedLoading'
import useDrawer from '~/composables/ui/useDrawer'
import { tagOptions } from '~/config/dish-tags'

const props = defineProps<{
  tenantId: string
  categoryId: string
  categories: Category[]
}>()

const emit = defineEmits<{
  combosChanged: []
}>()

const { tenantId: tenantIdRef, categoryId: categoryIdRef } = toRefs(props)

const { combos, loading: combosLoading, add: rawAddCombo, update: rawUpdateCombo, remove: rawRemoveCombo, toggleActive, reorder }
  = useCombos(tenantIdRef, categoryIdRef)

const addCombo = async (...args: Parameters<typeof rawAddCombo>) => {
  const combo = await rawAddCombo(...args)

  emit('combosChanged')

  return combo
}

const updateCombo = async (...args: Parameters<typeof rawUpdateCombo>) => {
  await rawUpdateCombo(...args)
  emit('combosChanged')
}

const removeCombo = async (...args: Parameters<typeof rawRemoveCombo>) => {
  await rawRemoveCombo(...args)
  emit('combosChanged')
}

const { showSkeleton } = useDelayedLoading(combosLoading)

const { confirm } = useConfirm()

const { isOpen: comboModalOpen, data: editingCombo, open: openComboModal, close: closeComboModal } = useDrawer<Combo>()

const confirmDeleteCombo = async (id: string) => {
  const ok = await confirm({
    title: 'Удалить комбо?',
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (ok) await removeCombo(id)
}

const reorderCombos = () => reorder(combos.value)
</script>

<style scoped lang="scss">
.combos-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 12px;
}

.grid-wrap {
  overflow-y: auto;
  flex: 1;
  padding-top: 2px;
}

.card-ghost {
  opacity: 0.35;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.combo-card {
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &.inactive {
    opacity: 0.5;
  }
}

.card-photo {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.combo-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.combo-price {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-btns {
  display: flex;
  gap: 8px;
}
</style>
