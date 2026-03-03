<template>
  <main class="dishes-root">
    <div v-if="!categoryId" class="no-category">
      <span>← Выберите категорию</span>
    </div>

    <template v-else>
      <UiSectionHeader label="Блюда">
        <UiButton
          size="small"
          type="default"
          icon="plus"
          @click="openDishModal(null)"
        >Добавить</UiButton>
      </UiSectionHeader>

      <div class="grid-wrap">
        <UiSkeleton v-if="dishesLoading" text :repeat="6" />

        <UiAppEmpty v-else-if="dishes.length === 0" icon="🍽" text="В этой категории пока нет блюд" />

        <UiGrid
          v-else
          :items="dishes"
          key-field="id"
          :columns="{ s: 2, m: 3, l: 4 }"
          :gap="10"
          no-animation
        >
          <template #default="{ item: dish }">
            <UiCard size="tiny" class="dish-card" :class="{ inactive: !dish.active }">
              <UiSpace :size="8" vertical>
                <div class="card-photo">
                  <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" />
                  <span v-else class="photo-placeholder">🍽</span>
                </div>

                <span class="dish-name">{{ dish.name }}</span>

                <UiSpace :size="4" align="center">
                  <span class="dish-price">{{ formatPrice(dish.price) }}</span>
                  <UiTag v-for="tag in dish.tags" :key="tag" size="tiny">{{ tagOptions[tag] }}</UiTag>
                </UiSpace>

                <div class="card-actions">
                  <UiSwitch
                    :model-value="dish.active"
                    @update:model-value="toggleActive(dish.id, $event)"
                  />
                  <div class="card-btns">
                    <UiButton
                      type="text"
                      size="tiny"
                      icon="pencil"
                      title="Редактировать"
                      @click="openDishModal(dish)"
                    />
                    <UiButton
                      type="text"
                      size="tiny"
                      icon="trash"
                      title="Удалить"
                      @click="confirmDeleteDish(dish.id)"
                    />
                  </div>
                </div>
              </UiSpace>
            </UiCard>
          </template>
        </UiGrid>
      </div>
    </template>

    <MenuDishFormModal
      v-if="categoryId"
      v-model="dishModalOpen"
      :tenant-id="tenantId"
      :category-id="categoryId"
      :dish="editingDish"
      :add-dish="addDish"
      :update-dish="updateDish"
      @saved="dishModalOpen = false"
    />
  </main>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiSkeleton, UiSpace, UiTag, UiCard, UiGrid, UiSwitch, useConfirm } from '@fastio/ui'
import type { Dish } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import UiAppEmpty from '~/components/ui/AppEmpty.vue'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import MenuDishFormModal from '~/components/menu/DishFormModal.vue'
import { useDishes } from '~/composables/useDishes'
import { tagOptions } from '~/config/dish-tags'

const props = defineProps<{
  tenantId: string
  categoryId: string | null
}>()

const tenantIdRef = computed(() => props.tenantId)
const categoryIdRef = computed(() => props.categoryId)

const { dishes, loading: dishesLoading, add: addDish, update: updateDish, remove: removeDish, toggleActive }
  = useDishes(tenantIdRef, categoryIdRef)

const { confirm } = useConfirm()

const dishModalOpen = ref(false)
const editingDish = ref<Dish | null>(null)

const openDishModal = (dish: Dish | null) => {
  editingDish.value = dish
  dishModalOpen.value = true
}

const confirmDeleteDish = async (id: string) => {
  const ok = await confirm({
    title: 'Удалить блюдо?',
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (ok) await removeDish(id)
}
</script>

<style scoped lang="scss">
.dishes-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.no-category {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: 15px;
}

.grid-wrap {
  overflow-y: auto;
  flex: 1;
}

.dish-card {
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

.photo-placeholder {
  font-size: 28px;
}

.dish-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dish-price {
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
  gap: 2px;
}
</style>
