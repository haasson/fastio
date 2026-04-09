<template>
  <UiCollapseItem name="composition" title="Состав комбо">
    <div class="content">
      <div v-if="loading" class="loading">
        <UiSkeleton :height="80" :count="2" />
      </div>

      <template v-else>
        <!-- Список блюд -->
        <ul v-if="modelValue.length > 0" class="items-list">
          <DishItemRow
            v-for="(item, i) in modelValue"
            :key="item.dishId || i"
            :name="getDishName(item.dishId)"
            :category-name="getCategoryName(item.dishId)"
            :modifiers="getSelectedModifierTags(item)"
          >
            <span v-if="getDishStatus(item.dishId)" class="dish-status" :class="`dish-status--${getDishStatus(item.dishId)}`">
              {{ getDishStatus(item.dishId) === 'deleted' ? 'удалено' : 'отключено' }}
            </span>
            <span v-else-if="getModifierStatus(item)" class="dish-status dish-status--inactive">
              модификатор отключен
            </span>
            <span class="item-price">{{ getItemPrice(item) }} ₽</span>
            <UiButton
              type="text"
              size="small"
              icon="close"
              @click="removeItem(i)"
            />
          </DishItemRow>
        </ul>

        <!-- Добавление блюда -->
        <UiButton type="primary" icon="plus" @click="showPicker = true">
          Добавить блюдо
        </UiButton>

        <DishPickerModal
          v-model="showPicker"
          :tenant-id="tenantId"
          :excluded-dish-ids="selectedDishIds"
          @select="onAddItem"
        />

        <!-- Итого -->
        <div v-if="modelValue.length > 0" class="totals">
          <div class="total-row">
            <span class="total-label">Сумма блюд</span>
            <span class="total-value">{{ dishesTotal }} ₽</span>
          </div>
          <template v-if="comboPrice !== null && comboPrice > 0">
            <div class="total-row">
              <span class="total-label">Цена комбо</span>
              <span class="total-value">{{ comboPrice }} ₽</span>
            </div>
            <div class="total-row" :class="discountClass">
              <span class="total-label">{{ discountLabel }}</span>
              <span class="total-value">{{ discountFormatted }}</span>
            </div>
          </template>
        </div>
      </template>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiCollapseItem, UiButton, UiSkeleton } from '@fastio/ui'
import DishItemRow from '~/components/ui/DishItemRow.vue'
import type { Category, ComboItemInput, DishModifierGroup } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import DishPickerModal, { type DishPickerResult } from '~/components/menu/DishPickerModal.vue'

type DishInfo = { id: string; name: string; categoryId: string; price: number; active: boolean }

const props = defineProps<{
  modelValue: ComboItemInput[]
  tenantId: string
  categories: Category[]
  refreshKey: number
  comboPrice: number | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: ComboItemInput[]] }>()

const api = useDatabase()
const loading = ref(false)
const showPicker = ref(false)
const allDishes = ref<DishInfo[]>([])
const dishModifiers = ref<Record<string, DishModifierGroup[]>>({})

// ─── Lookups ─────────────────────────────────────────────────────────────────

const getDish = (dishId: string) => allDishes.value.find((d) => d.id === dishId)
const getDishName = (dishId: string) => getDish(dishId)?.name ?? 'Удалённое блюдо'
const getDishStatus = (dishId: string): 'deleted' | 'inactive' | null => {
  const dish = getDish(dishId)

  if (!dish) return 'deleted'
  if (!dish.active) return 'inactive'

  return null
}
const getDishPrice = (dishId: string) => getDish(dishId)?.price ?? 0
const getDishModifiers = (dishId: string): DishModifierGroup[] => dishModifiers.value[dishId] ?? []

const getCategoryName = (dishId: string) => {
  const categoryId = getDish(dishId)?.categoryId

  return props.categories.find((c) => c.id === categoryId)?.name ?? null
}

const getModifierStatus = (item: ComboItemInput): 'inactive' | null => {
  if (item.modifierOptionIds.length === 0) return null
  const allOptions = getDishModifiers(item.dishId).flatMap((g) => g.options)
  const activeOptionIds = new Set(allOptions.filter((o) => o.active).map((o) => o.optionId))

  return item.modifierOptionIds.some((id) => !activeOptionIds.has(id)) ? 'inactive' : null
}

const getSelectedModifierTags = (item: ComboItemInput) => getDishModifiers(item.dishId)
  .flatMap((g) => g.options)
  .filter((o) => item.modifierOptionIds.includes(o.optionId))
  .map((o) => ({ name: o.optionName, priceDelta: o.priceDelta }))

// ─── Options ──────────────────────────────────────────────────────────────────

const selectedDishIds = computed(() => props.modelValue.map((item) => item.dishId).filter(Boolean))

// ─── Totals ───────────────────────────────────────────────────────────────────

const getItemPrice = (item: ComboItemInput) => {
  const base = getDishPrice(item.dishId)
  const modifierDelta = getDishModifiers(item.dishId)
    .flatMap((g) => g.options)
    .filter((o) => item.modifierOptionIds.includes(o.optionId))
    .reduce((sum, o) => sum + o.priceDelta, 0)

  return base + modifierDelta
}

const dishesTotal = computed(() => props.modelValue.reduce((sum, item) => sum + getItemPrice(item), 0))

const discount = computed(() => {
  if (props.comboPrice === null || props.comboPrice <= 0) return null

  return dishesTotal.value - props.comboPrice
})

const discountLabel = computed(() => {
  if (discount.value === null) return ''
  if (discount.value > 0) return 'Экономия'
  if (discount.value < 0) return 'Наценка'

  return 'Без изменений'
})

const discountFormatted = computed(() => {
  if (discount.value === null || discount.value === 0) return '—'
  const pct = dishesTotal.value > 0 ? Math.round((Math.abs(discount.value) / dishesTotal.value) * 100) : 0
  const sign = discount.value > 0 ? '−' : '+'

  return `${sign}${Math.abs(discount.value)} ₽ (${pct}%)`
})

const discountClass = computed(() => {
  if (discount.value === null) return ''
  if (discount.value > 0) return 'is-saving'
  if (discount.value < 0) return 'is-markup'

  return ''
})

// ─── Add / Remove ─────────────────────────────────────────────────────────────

const loadModifiers = async (dishId: string) => {
  if (!dishId || dishModifiers.value[dishId] !== undefined) return
  const groups = await api.dishes.getDishModifiers(dishId)

  dishModifiers.value = { ...dishModifiers.value, [dishId]: groups }
}

const onAddItem = async (result: DishPickerResult) => {
  if (!result.dishId) return
  await loadModifiers(result.dishId)
  emit('update:modelValue', [...props.modelValue, { dishId: result.dishId, modifierOptionIds: result.modifierOptionIds }])
}

const removeItem = (i: number) => {
  const updated = [...props.modelValue]

  updated.splice(i, 1)
  emit('update:modelValue', updated)
}

// ─── Load ──────────────────────────────────────────────────────────────────────

watch(
  () => props.refreshKey,
  async () => {
    if (!props.tenantId) return
    loading.value = true
    const dishes = await api.dishes.listAllIncludingInactive(props.tenantId)

    allDishes.value = dishes.map((d) => ({ id: d.id, name: d.name, categoryId: d.categoryId, price: d.price, active: d.active }))
    await Promise.all(props.modelValue.map((item) => (item.dishId ? loadModifiers(item.dishId) : Promise.resolve())))
    loading.value = false
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  async (items, old) => {
    const existingIds = new Set((old ?? []).map((i) => i.dishId))
    const newItems = items.filter((i) => i.dishId && !existingIds.has(i.dishId))

    await Promise.all(newItems.map((item) => loadModifiers(item.dishId)))
  },
)
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// ─── List ─────────────────────────────────────────────────────────────────────

.items-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  overflow: hidden;
}

.item-price {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  min-width: 60px;
  text-align: right;
  flex-shrink: 0;
}

.dish-status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 5px;
  flex-shrink: 0;

  &--inactive {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }

  &--deleted {
    background: var(--color-error-light);
    color: var(--color-error);
  }
}

// ─── Totals ───────────────────────────────────────────────────────────────────

.totals {
  padding: 10px 12px;
  background: var(--color-bg-page);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;

  &.is-saving .total-value {
    color: var(--color-success);
    font-weight: 600;
  }

  &.is-markup .total-value {
    color: var(--color-warning);
    font-weight: 600;
  }
}

.total-label {
  color: var(--color-text-secondary);
}

.total-value {
  font-weight: 500;
}
</style>
