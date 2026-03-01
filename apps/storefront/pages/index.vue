<template>
  <div class="page-root">
    <TheHeader v-if="tenant" :tenant="tenant" />
    <MenuCategoryNav
      :categories="categories"
      :active-category-id="activeCategoryId"
      @select="scrollToCategory"
    />

    <main class="main">
      <div class="container">
        <!-- Секции по категориям -->
        <section
          v-for="cat in categories"
          :key="cat.id"
          :ref="(el) => setSectionRef(cat.id, el)"
          class="category-section"
        >
          <h2 class="category-title">{{ cat.name }}</h2>
          <div class="dish-grid">
            <MenuDishCard
              v-for="dish in dishesByCategory[cat.id]"
              :key="dish.id"
              :dish="dish"
              @open="openDish"
            />
          </div>
        </section>

        <div v-if="categories.length === 0" class="empty">
          Меню пока не заполнено
        </div>
      </div>
    </main>

    <!-- Плавающая кнопка корзины (мобилка) -->
    <Transition name="fab">
      <NuxtLink v-if="cartStore.count > 0" to="/cart" class="cart-fab">
        🛒 Корзина · {{ cartStore.subtotal }} ₽
        <span class="fab-count">{{ cartStore.count }}</span>
      </NuxtLink>
    </Transition>

    <!-- Модалка блюда -->
    <MenuDishModal :dish="selectedDish" @close="selectedDish = null" />
  </div>
</template>

<script setup lang="ts">
import type { Tenant, Category, Dish } from '@fastfood-saas/shared'
import { useCartStore } from '~/stores/cart'

const cartStore = useCartStore()

const { data: tenant } = await useAsyncData<Tenant>('tenant', () => $fetch('/api/tenant'))
const { data: menu } = await useAsyncData<{ categories: Category[]; dishes: Dish[] }>(
  'menu',
  () => $fetch('/api/menu'),
)

const categories = computed(() => menu.value?.categories ?? [])
const dishes = computed(() => menu.value?.dishes ?? [])

const dishesByCategory = computed(() => {
  const map: Record<string, Dish[]> = {}
  for (const dish of dishes.value) {
    if (!map[dish.categoryId]) map[dish.categoryId] = []
    map[dish.categoryId].push(dish)
  }
  return map
})

// Активная категория при скролле
const activeCategoryId = ref<string | null>(categories.value[0]?.id ?? null)
const sectionRefs = new Map<string, Element>()

function setSectionRef(id: string, el: unknown) {
  if (el instanceof Element) sectionRefs.set(id, el)
}

function updateActiveCategory() {
  const offset = 130
  let current: string | null = null
  for (const [id, el] of sectionRefs) {
    const top = el.getBoundingClientRect().top
    if (top - offset <= 0) current = id
  }
  if (current) activeCategoryId.value = current
}

onMounted(() => window.addEventListener('scroll', updateActiveCategory, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', updateActiveCategory))

function scrollToCategory(id: string) {
  const el = sectionRefs.get(id)
  if (el) {
    const offset = 120
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }
}

// Модалка
const selectedDish = ref<Dish | null>(null)
function openDish(dish: Dish) { selectedDish.value = dish }

// Meta
useHead({ title: 'Меню' })
</script>

<style scoped>
.page-root { min-height: 100vh; background: #f7f7f8; }

.main { padding: 24px 0 100px; }

.container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }

.category-section { margin-bottom: 40px; }

.category-title {
  font-size: 20px;
  font-weight: 800;
  color: #111;
  margin-bottom: 16px;
}

.dish-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.empty {
  text-align: center;
  padding: 80px 0;
  color: #bbb;
  font-size: 16px;
}

/* FAB корзины */
.cart-fab {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--primary);
  color: #fff;
  padding: 0 20px;
  height: 52px;
  border-radius: 26px;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  z-index: 150;
  white-space: nowrap;
}

.fab-count {
  background: #fff;
  color: var(--primary);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab-enter-active, .fab-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fab-enter-from, .fab-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

@media (min-width: 768px) {
  .cart-fab { display: none; }
}
</style>
