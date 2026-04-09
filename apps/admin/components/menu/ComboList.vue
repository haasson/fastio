<template>
  <main class="combos-root">
    <UiSectionHeader title="Комбо">
      <template #left>
        <UiSegmentedControl
          v-model="comboView"
          :items="VIEW_ITEMS"
          size="medium"
        />
      </template>
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
        <UiEmpty v-if="combos.length === 0" icon="dishes" text="В этой категории пока нет комбо" />

        <template v-else>
          <!-- Карточки -->
          <div v-if="comboView === 'cards'" class="cards-grid">
            <MenuItemCard
              v-for="combo in combos"
              :key="combo.id"
              :photo="combo.photos[0]"
              :name="combo.name"
              :price="combo.price"
              :tags="combo.tags"
              :active="combo.active"
              :warning="brokenComboIds.has(combo.id)"
              :tag-name="tagName"
              :tag-style="tagStyle"
              @click="openComboModal(combo)"
              @toggle-active="toggleActive(combo.id, $event)"
              @delete="confirmDeleteCombo(combo.id)"
            />
          </div>

          <!-- Порядок -->
          <AppDraggableList
            v-else-if="comboView === 'order'"
            v-model="combos"
            @reorder="reorderCombos"
          >
            <AppListRow
              v-for="combo in combos"
              :key="combo.id"
              :name="combo.name"
              :thumb-url="combo.photos[0] ?? null"
              thumb-width="40px"
              thumb-height="40px"
              :disabled="!combo.active"
            >
              <UiTag
                v-if="brokenComboIds.has(combo.id)"
                type="warning"
                icon="warningRound"
                size="small"
              >Скрыто в меню</UiTag>
              <template #append>
                <span class="order-price">{{ formatPrice(combo.price) }}</span>
              </template>
            </AppListRow>
          </AppDraggableList>
        </template>
      </template>
    </div>

    <MenuComboFormDrawer
      v-model="comboModalOpen"
      :tenant-id="tenantId"
      :categories="categories"
      :combo="editingCombo"
      :tags="props.tags"
      :add-combo="addCombo"
      :update-combo="updateCombo"
      @saved="closeComboModal"
    />
  </main>
</template>

<script setup lang="ts">
import { toRefs, computed, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { UiButton, UiSkeleton, UiSectionHeader, UiSegmentedControl, UiEmpty, UiTag } from '@fastio/ui'
import type { Combo, Category, DishTagDefinition } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import MenuItemCard from '~/components/menu/ItemCard.vue'
import MenuComboFormDrawer from '~/components/menu/ComboFormDrawer.vue'
import { useCombos } from '~/composables/data/useCombos'
import { useItemManager } from '~/composables/ui/useItemManager'
import { useTagDisplay } from '~/composables/ui/useTagDisplay'
import { useDatabase } from '~/composables/data/useDatabase'

const props = defineProps<{
  tenantId: string
  categoryId: string
  categories: Category[]
  tags: DishTagDefinition[]
}>()

const emit = defineEmits<{
  combosChanged: []
}>()

const { tenantId: tenantIdRef, categoryId: categoryIdRef } = toRefs(props)

const api = useDatabase()
const brokenComboIds = ref<Set<string>>(new Set())

const { combos, loading: combosLoading, add: rawAddCombo, update: rawUpdateCombo, remove: rawRemoveCombo, toggleActive, reorder }
  = useCombos(tenantIdRef, categoryIdRef)

const refreshBrokenIds = async () => {
  if (combos.value.length === 0) {
    brokenComboIds.value = new Set()

    return
  }
  brokenComboIds.value = await api.combos.getComboIdsWithBrokenDishes(combos.value.map((c) => c.id))
}

watch(combos, refreshBrokenIds, { immediate: true })

const addCombo = async (...args: Parameters<typeof rawAddCombo>) => {
  const combo = await rawAddCombo(...args)

  emit('combosChanged')

  return combo
}

const updateCombo = async (...args: Parameters<typeof rawUpdateCombo>) => {
  await rawUpdateCombo(...args)
  emit('combosChanged')
  await refreshBrokenIds()
}

const removeCombo = async (...args: Parameters<typeof rawRemoveCombo>) => {
  await rawRemoveCombo(...args)
  emit('combosChanged')
}

const VIEW_ITEMS = [
  { label: 'Карточки', value: 'cards' },
  { label: 'Порядок', value: 'order' },
]

const comboView = useLocalStorage<'cards' | 'order'>('menu:combo-view', 'cards')

const { showSkeleton, modalOpen: comboModalOpen, editingItem: editingCombo, openModal: openComboModal, closeModal: closeComboModal, confirmDelete: confirmDeleteCombo }
  = useItemManager<Combo>({ loading: combosLoading, remove: removeCombo, confirmTitle: 'Удалить комбо?' })

const reorderCombos = () => reorder(combos.value)

const { tagName, tagStyle } = useTagDisplay(computed(() => props.tags))
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

.order-price {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}

</style>
