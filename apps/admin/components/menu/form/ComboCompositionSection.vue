<template>
  <UiCollapseItem name="composition" title="Состав комбо">
    <div class="content">
      <div v-if="loading" class="loading">
        <UiSkeleton :height="80" :count="2" />
      </div>

      <template v-else>
        <!-- Список блюд -->
        <ul v-if="displayItems.length > 0" class="items-list">
          <DishItemRow
            v-for="item in displayItems"
            :key="item.key"
            :name="getDishName(item.dishId)"
            :category-name="getCategoryName(item.dishId)"
            :modifiers="getSelectedModifierTags(item)"
            :addons="getSelectedAddonTags(item)"
          >
            <span v-if="getDishStatus(item.dishId)" class="dish-status" :class="`dish-status--${getDishStatus(item.dishId)}`">
              {{ getDishStatus(item.dishId) === 'deleted' ? 'удалено' : 'отключено' }}
            </span>
            <span v-else-if="getModifierStatus(item)" class="dish-status dish-status--inactive">
              модификатор отключен
            </span>
            <span v-else-if="getAddonStatus(item)" class="dish-status dish-status--inactive">
              добавка отключена
            </span>
            <div class="qty-controls">
              <UiButton
                type="text"
                size="small"
                icon="minusRound"
                @click="changeQty(item.key, -1)"
              />
              <span class="qty-value">{{ item.quantity }}</span>
              <UiButton
                type="text"
                size="small"
                icon="plusRound"
                @click="changeQty(item.key, 1)"
              />
            </div>
            <span class="item-price">{{ getItemPrice(item) * item.quantity }} ₽</span>
          </DishItemRow>
        </ul>

        <!-- Добавление блюда -->
        <UiButton type="primary" icon="plus" @click="showPicker = true">
          Добавить блюдо
        </UiButton>

        <DishPickerModal
          v-model="showPicker"
          :tenant-id="tenantId"
          @select="onAddItem"
        />

        <!-- Итого -->
        <div v-if="displayItems.length > 0" class="totals">
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
import type { Addon, Category, ComboItemInput, DishModifierGroup } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import DishPickerModal, { type DishPickerResult } from '~/components/menu/DishPickerModal.vue'

type DishInfo = { id: string; name: string; categoryId: string; price: number; active: boolean; deleted?: boolean }

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
const allAddons = ref<Addon[]>([])
const addonsLoaded = ref(false)

// ─── Lookups ─────────────────────────────────────────────────────────────────

const getDish = (dishId: string) => allDishes.value.find((d) => d.id === dishId)
const getDishName = (dishId: string) => getDish(dishId)?.name ?? 'Удалённое блюдо'
const getDishStatus = (dishId: string): 'deleted' | 'inactive' | null => {
  const dish = getDish(dishId)

  if (!dish) return 'deleted'
  if (dish.deleted) return 'deleted'
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

const getAddonStatus = (item: ComboItemInput): 'inactive' | null => {
  if (!item.addonIds?.length) return null
  const activeAddonIds = new Set(allAddons.value.filter((a) => a.active).map((a) => a.id))

  return item.addonIds.some((id) => !activeAddonIds.has(id)) ? 'inactive' : null
}

const getSelectedModifierTags = (item: ComboItemInput) => getDishModifiers(item.dishId)
  .flatMap((g) => g.options)
  .filter((o) => item.modifierOptionIds.includes(o.optionId))
  .map((o) => ({ name: o.optionName, priceDelta: o.priceDelta }))

const getSelectedAddonTags = (item: ComboItemInput) => {
  if (!item.addonIds?.length) return []

  return allAddons.value
    .filter((a) => item.addonIds!.includes(a.id))
    .map((a) => ({ name: a.name, price: a.price }))
}

// ─── Display items (grouped by dish + modifiers + addons) ─────────────────────

type DisplayItem = ComboItemInput & { key: string; quantity: number }

const itemKey = (item: ComboItemInput) => `${item.dishId}::${[...item.modifierOptionIds].sort().join(',')}::${[...(item.addonIds ?? [])].sort().join(',')}`

const displayItems = computed<DisplayItem[]>(() => {
  const map = new Map<string, DisplayItem>()

  for (const item of props.modelValue) {
    const key = itemKey(item)
    const existing = map.get(key)

    if (existing) existing.quantity++
    else map.set(key, { ...item, key, quantity: 1 })
  }

  return [...map.values()]
})

// ─── Totals ───────────────────────────────────────────────────────────────────

const getItemPrice = (item: ComboItemInput) => {
  const base = getDishPrice(item.dishId)
  const modifierDelta = getDishModifiers(item.dishId)
    .flatMap((g) => g.options)
    .filter((o) => item.modifierOptionIds.includes(o.optionId))
    .reduce((sum, o) => sum + o.priceDelta, 0)
  const addonsDelta = (item.addonIds ?? [])
    .map((id) => allAddons.value.find((a) => a.id === id)?.price ?? 0)
    .reduce((sum, p) => sum + p, 0)

  return base + modifierDelta + addonsDelta
}

const dishesTotal = computed(() => displayItems.value.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0))

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

const loadAllAddons = async () => {
  if (addonsLoaded.value) return
  allAddons.value = await api.addons.list(props.tenantId)
  addonsLoaded.value = true
}

const loadDishData = async (dishId: string) => {
  if (!dishId || dishModifiers.value[dishId] !== undefined) return
  const groups = await api.dishes.getDishModifiers(dishId)

  dishModifiers.value = { ...dishModifiers.value, [dishId]: groups }
}

const onAddItem = async (result: DishPickerResult) => {
  if (!result.dishId) return
  await Promise.all([loadDishData(result.dishId), loadAllAddons()])
  emit('update:modelValue', [...props.modelValue, {
    dishId: result.dishId,
    modifierOptionIds: result.modifierOptionIds,
    addonIds: result.addons.map((a) => a.addonId),
  }])
}

const changeQty = (key: string, delta: number) => {
  const item = displayItems.value.find((d) => d.key === key)

  if (!item) return

  if (delta > 0) {
    emit('update:modelValue', [...props.modelValue, { dishId: item.dishId, modifierOptionIds: item.modifierOptionIds, addonIds: item.addonIds }])
  } else {
    const updated = [...props.modelValue]

    for (let i = updated.length - 1; i >= 0; i--) {
      if (itemKey(updated[i]) === key) {
        updated.splice(i, 1)
        break
      }
    }
    emit('update:modelValue', updated)
  }
}

// ─── Load ──────────────────────────────────────────────────────────────────────

const fetchMissingDishesAndModifiers = async (items: ComboItemInput[]) => {
  const loadedIds = new Set(allDishes.value.map((d) => d.id))
  const missingIds = [...new Set(items.map((i) => i.dishId).filter((id) => id && !loadedIds.has(id)))]

  if (missingIds.length > 0) {
    const fetched = await api.dishes.listByIds(props.tenantId, missingIds)

    allDishes.value = [
      ...allDishes.value,
      ...fetched.map((d) => ({ id: d.id, name: d.name, categoryId: d.categoryId, price: d.price, active: false, deleted: true })),
    ]
  }

  const uniqueDishIds = [...new Set(items.map((i) => i.dishId).filter(Boolean))]

  await Promise.all([
    loadAllAddons(),
    ...uniqueDishIds.map((id) => loadDishData(id)),
  ])
}

watch(
  () => props.refreshKey,
  async () => {
    if (!props.tenantId) return
    loading.value = true
    const dishes = await api.dishes.listAllIncludingInactive(props.tenantId)

    allDishes.value = dishes.map((d) => ({ id: d.id, name: d.name, categoryId: d.categoryId, price: d.price, active: d.active }))
    await fetchMissingDishesAndModifiers(props.modelValue)
    loading.value = false
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  async (items, old) => {
    const existingIds = new Set((old ?? []).map((i) => i.dishId))
    const newItems = items.filter((i) => i.dishId && !existingIds.has(i.dishId))

    await fetchMissingDishesAndModifiers(newItems)
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

.qty-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.qty-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  min-width: 18px;
  text-align: center;
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
