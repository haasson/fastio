<template>
  <div class="menu-root">
    <!-- Нет тенанта -->
    <div v-if="!tenantStore.tenant && !tenantStore.loading" class="empty-state">
      <p>Заведение не найдено. Обратитесь в поддержку.</p>
    </div>

    <template v-else-if="tenantStore.tenant">
      <div class="layout">
        <!-- ─── Категории ─── -->
        <aside class="categories-panel">
          <div class="panel-header">
            <span class="panel-title">Категории</span>
            <button class="btn-add" @click="openCategoryModal(null)">+ Добавить</button>
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
                <button class="icon-btn" title="Редактировать" @click="openCategoryModal(cat)">✏️</button>
                <button class="icon-btn danger" title="Удалить" @click="confirmDeleteCategory(cat.id)">🗑</button>
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
              <button class="btn-add" @click="openDishModal(null)">+ Добавить блюдо</button>
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
                  <AppToggle
                    :model-value="dish.active"
                    @update:model-value="toggleActive(dish.id, $event)"
                  />
                  <button class="icon-btn" title="Редактировать" @click="openDishModal(dish)">✏️</button>
                  <button class="icon-btn danger" title="Удалить" @click="confirmDeleteDish(dish.id)">🗑</button>
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
    <AppModal v-model="categoryModalOpen" :title="editingCategory ? 'Редактировать категорию' : 'Новая категория'" width="400px">
      <form class="form" @submit.prevent="saveCategory">
        <div class="field">
          <label class="label">Название</label>
          <input v-model="categoryForm.name" class="input" type="text" placeholder="Например: Пицца" required autofocus />
        </div>
        <div class="form-footer">
          <button type="button" class="btn-secondary" @click="categoryModalOpen = false">Отмена</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- ─── Модалка: блюдо ─── -->
    <DishFormModal
      v-if="tenantStore.tenant"
      v-model="dishModalOpen"
      :tenant-id="tenantStore.tenant.id"
      :category-id="selectedCategoryId!"
      :dish="editingDish"
      @saved="dishModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
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

// ─── Блюда ───
const { dishes, loading: dishesLoading, add: addDish, update: updateDish, remove: removeDish, toggleActive } =
  useDishes(tenantId, selectedCategoryId)

const dishCountByCategory = computed(() => {
  // Для счётчика грузим все блюда — пока простой подход, TODO оптимизировать
  const counts: Record<string, number> = {}
  categories.value.forEach((c) => { counts[c.id] = 0 })
  return counts
})

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

<style scoped>
.menu-root {
  height: 100%;
}

.layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  height: calc(100vh - 60px - 48px);
}

/* ─── Панели ─── */
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

.btn-add {
  font-size: 13px;
  font-weight: 600;
  color: #ff6b35;
  background: #fff4f0;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-add:hover {
  background: #ffe8df;
}

/* ─── Список категорий ─── */
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
}

.category-item:hover {
  background: #f7f7f7;
}

.category-item.selected {
  background: #fff4f0;
}

.category-item.inactive .cat-name {
  opacity: 0.45;
  text-decoration: line-through;
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

.category-item:hover .cat-actions {
  opacity: 1;
}

.category-empty,
.dish-empty {
  padding: 24px;
  text-align: center;
  color: #bbb;
  font-size: 13px;
}

/* ─── Список блюд ─── */
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
}

.dish-item:hover {
  background: #f7f7f7;
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
}

.dish-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
}

.dish-name.inactive {
  opacity: 0.4;
  text-decoration: line-through;
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

/* ─── Общие кнопки ─── */
.icon-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}

.icon-btn:hover {
  background: #f0f0f0;
}

.icon-btn.danger:hover {
  background: #ffeaea;
}

/* ─── Форма в модалке ─── */
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.input {
  height: 42px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: #ff6b35;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.btn-primary,
.btn-secondary {
  height: 38px;
  padding: 0 18px;
  border-radius: 9px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-primary {
  background: #ff6b35;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #e55a25;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f0f0f0;
  color: #555;
}

.btn-secondary:hover {
  background: #e5e5e5;
}

/* ─── Пустое состояние ─── */
.empty-state,
.loading {
  padding: 40px;
  text-align: center;
  color: #aaa;
}

/* ─── Адаптив ─── */
@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
    height: auto;
  }
}
</style>
