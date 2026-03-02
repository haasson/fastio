<template>
  <div class="menu-root">
    <div v-if="!tenantStore.tenant && !tenantStore.loading" class="empty-state">
      <p>Заведение не найдено. Обратитесь в поддержку.</p>
    </div>

    <template v-else-if="tenantStore.tenant">
      <div class="layout">
        <!-- ─── Категории ─── -->
        <aside class="categories-panel">
          <div class="panel-header">
            <span class="panel-title">Категории</span>
            <UiButton size="small" type="tertiary" @click="openCategoryModal(null)">+ Добавить</UiButton>
          </div>

          <div v-if="categoriesLoading" class="loading">Загрузка…</div>

          <ul v-else class="category-list">
            <li
              v-for="cat in categories"
              :key="cat.id"
              class="category-item"
              :class="{ selected: selectedCategoryId === cat.id, inactive: !cat.active }"
              @click="selectedCategoryId = cat.id"
            >
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-count">{{ dishCountByCategory[cat.id] ?? 0 }}</span>
              <div class="cat-actions" @click.stop>
                <UiButton size="tiny" type="text" title="Редактировать" @click="openCategoryModal(cat)">✏️</UiButton>
                <UiButton size="tiny" type="text" title="Удалить" @click="confirmDeleteCategory(cat.id)">🗑</UiButton>
              </div>
            </li>

            <li v-if="categories.length === 0" class="category-empty">
              Категорий пока нет
            </li>
          </ul>
        </aside>

        <!-- ─── Блюда ─── -->
        <main class="dishes-panel">
          <div v-if="!selectedCategoryId" class="no-category">
            <span>← Выберите категорию</span>
          </div>

          <template v-else>
            <div class="panel-header">
              <span class="panel-title">
                {{ selectedCategory?.name }}
                <span class="dish-count">({{ dishes.length }})</span>
              </span>
              <UiButton size="small" type="tertiary" @click="openDishModal(null)">+ Добавить блюдо</UiButton>
            </div>

            <div v-if="dishesLoading" class="loading">Загрузка…</div>

            <ul v-else class="dish-list">
              <li v-for="dish in dishes" :key="dish.id" class="dish-item">
                <div class="dish-photo">
                  <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" />
                  <span v-else class="photo-placeholder">🍽</span>
                </div>

                <div class="dish-info">
                  <span class="dish-name" :class="{ inactive: !dish.active }">{{ dish.name }}</span>
                  <span class="dish-meta">
                    <span class="dish-price">{{ dish.price }} ₽</span>
                    <span v-if="dish.tags.length" class="dish-tags">
                      <span v-for="tag in dish.tags" :key="tag" class="tag">{{ tagLabel[tag] }}</span>
                    </span>
                  </span>
                </div>

                <div class="dish-actions">
                  <!-- TODO: заменить на UiSwitch когда добавят в @fastfood-saas/ui -->
                  <UiAppToggle
                    :model-value="dish.active"
                    @update:model-value="toggleActive(dish.id, $event)"
                  />
                  <UiButton size="tiny" type="text" title="Редактировать" @click="openDishModal(dish)">✏️</UiButton>
                  <UiButton size="tiny" type="text" title="Удалить" @click="confirmDeleteDish(dish.id)">🗑</UiButton>
                </div>
              </li>

              <li v-if="dishes.length === 0" class="dish-empty">
                В этой категории пока нет блюд
              </li>
            </ul>
          </template>
        </main>
      </div>
    </template>

    <!-- ─── Модалка: категория ─── -->
    <UiDialog
      v-model="categoryModalOpen"
      :title="editingCategory ? 'Редактировать категорию' : 'Новая категория'"
      width="400px"
    >
      <form class="form" @submit.prevent="saveCategory">
        <UiInput v-model="categoryForm.name" label="Название" placeholder="Например: Пицца" autofocus />
        <div class="form-footer">
          <UiButton type="tertiary" @click="categoryModalOpen = false">Отмена</UiButton>
          <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
        </div>
      </form>
    </UiDialog>

    <!-- ─── Модалка: блюдо ─── -->
    <MenuDishFormModal
      v-if="tenantStore.tenant && selectedCategoryId"
      v-model="dishModalOpen"
      :tenant-id="tenantStore.tenant.id"
      :category-id="selectedCategoryId!"
      :dish="editingDish"
      @saved="dishModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { UiDialog, UiInput, UiButton } from '@fastfood-saas/ui'
import type { Category, Dish } from '@fastfood-saas/shared'
import { useTenantStore } from '~/stores/tenant'

definePageMeta({ middleware: 'auth' })

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

// ─── Категории ───
const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const { categories, loading: categoriesLoading, add: addCategory, update: updateCategory, remove: removeCategory } =
  useCategories(tenantId)

const selectedCategoryId = ref<string | null>(null)

const selectedCategory = computed(() =>
  categories.value.find((c) => c.id === selectedCategoryId.value),
)

watch(categories, (cats) => {
  if (!selectedCategoryId.value && cats.length > 0) {
    selectedCategoryId.value = cats[0].id
  }
})

// ─── Блюда ───
const { dishes, loading: dishesLoading, add: addDish, update: updateDish, remove: removeDish, toggleActive } =
  useDishes(tenantId, selectedCategoryId)

const { counts: dishCountByCategory } = useDishCounts(tenantId)

// ─── Тэги ───
const tagLabel: Record<string, string> = {
  spicy: '🌶 Острое',
  vegetarian: '🥦 Вегет.',
  vegan: '🌱 Веган',
  new: '🆕 Новинка',
  popular: '⭐ Популярное',
  hit: '🔥 Хит',
}

// ─── Модалка категории ───
const categoryModalOpen = ref(false)
const editingCategory = ref<Category | null>(null)
const categoryForm = reactive({ name: '' })
const saving = ref(false)

function openCategoryModal(cat: Category | null) {
  editingCategory.value = cat
  categoryForm.name = cat?.name ?? ''
  categoryModalOpen.value = true
}

async function saveCategory() {
  saving.value = true
  try {
    if (editingCategory.value) {
      await updateCategory(editingCategory.value.id, { name: categoryForm.name })
    } else {
      await addCategory(categoryForm.name)
    }
    categoryModalOpen.value = false
  } finally {
    saving.value = false
  }
}

async function confirmDeleteCategory(id: string) {
  if (confirm('Удалить категорию? Блюда в ней останутся в базе.')) {
    if (selectedCategoryId.value === id) selectedCategoryId.value = null
    await removeCategory(id)
  }
}

// ─── Модалка блюда ───
const dishModalOpen = ref(false)
const editingDish = ref<Dish | null>(null)

function openDishModal(dish: Dish | null) {
  editingDish.value = dish
  dishModalOpen.value = true
}

async function confirmDeleteDish(id: string) {
  if (confirm('Удалить блюдо?')) {
    await removeDish(id)
  }
}
</script>

<style scoped lang="scss">
@use '@fastfood-saas/ui/styles/mixins/media-queries' as *;

.menu-root {
  height: 100%;
}

.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  height: auto;

  @include mq-m {
    grid-template-columns: 260px 1fr;
    height: calc(100vh - 60px - 48px);
  }
}

.categories-panel,
.dishes-panel {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #111;
}

.dish-count {
  font-weight: 400;
  color: #999;
  font-size: 13px;
}

.category-list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
  padding: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: #f7f7f7;

    .cat-actions {
      opacity: 1;
    }
  }

  &.selected {
    background: #fff4f0;
  }

  &.inactive .cat-name {
    opacity: 0.45;
    text-decoration: line-through;
  }
}

.cat-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-count {
  font-size: 12px;
  color: #aaa;
  background: #f5f5f5;
  border-radius: 6px;
  padding: 1px 6px;
}

.cat-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.category-empty,
.dish-empty {
  padding: 24px;
  text-align: center;
  color: #bbb;
  font-size: 13px;
}

.dishes-panel {
  overflow: hidden;
}

.no-category {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  font-size: 15px;
}

.dish-list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dish-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 10px;
  transition: background 0.12s;

  &:hover {
    background: #f7f7f7;
  }
}

.dish-photo {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f5f5f5;
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
  font-size: 20px;
}

.dish-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.dish-name {
  font-size: 14px;
  font-weight: 600;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.inactive {
    opacity: 0.4;
    text-decoration: line-through;
  }
}

.dish-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dish-price {
  font-size: 13px;
  font-weight: 600;
  color: #ff6b35;
}

.dish-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag {
  font-size: 11px;
  background: #f5f5f5;
  border-radius: 4px;
  padding: 1px 5px;
  color: #666;
}

.dish-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.empty-state,
.loading {
  padding: 40px;
  text-align: center;
  color: #aaa;
}
</style>
