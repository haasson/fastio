<template>
  <UiModal
    :model-value="modelValue"
    :title="modalTitle"
    :width="680"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- ── Шаг 1: выбор ─────────────────────────────────────────────────── -->
    <div v-if="step === 'pick'" class="pick-content">
      <div v-if="loading" class="state">Загрузка…</div>
      <template v-else>
        <UiInput v-model="searchQuery" :placeholder="`Поиск ${item.gen}…`" clearable />

        <div v-if="!searchQuery" class="cats">
          <button
            v-if="showCombos && allCombos.length"
            class="cat"
            :class="{ active: selectedCatId === 'combos' }"
            @click="selectedCatId = 'combos'"
          >
            Комбо
          </button>
          <button
            v-for="cat in availableCategories"
            :key="cat.id"
            class="cat"
            :class="{ active: selectedCatId === cat.id }"
            @click="selectedCatId = cat.id"
          >
            {{ cat.name }}
          </button>
        </div>

        <div class="list">
          <div v-if="listEmptyMessage" class="state">{{ listEmptyMessage }}</div>
          <div
            v-for="entry in displayItems"
            :key="entry.data.id"
            class="item"
          >
            <div class="item-photo">
              <img
                v-if="entry.data.photos[0]"
                :src="entry.data.photos[0]"
                :alt="entry.data.name"
                class="item-img"
              />
              <div v-else class="item-no-photo" />
            </div>
            <span class="item-name">{{ entry.data.name }}</span>
            <span class="item-price">{{ entry.data.price }} ₽</span>
            <div class="item-controls">
              <UiStepper
                :model-value="dishQty[entry.data.id] ?? 1"
                :min="1"
                size="small"
                @update:model-value="dishQty[entry.data.id] = $event"
              />
              <UiButton size="small" type="primary" @click="onSelectItem(entry)">
                Добавить
              </UiButton>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ── Шаг 2: кастомизация ──────────────────────────────────────────── -->
    <div v-else-if="step === 'customize' && selectedDish" class="customize-content">
      <div class="dish-summary">
        <div class="summary-photo">
          <img v-if="selectedDish.photos[0]" :src="selectedDish.photos[0]" :alt="selectedDish.name" />
          <div v-else class="summary-no-photo" />
        </div>
        <div class="summary-info">
          <span class="summary-name">{{ selectedDish.name }}</span>
          <span class="summary-price">{{ selectedDish.price }} ₽</span>
        </div>
      </div>

      <div v-for="group in modifierGroups" :key="group.groupId" class="mod-group">
        <div class="section-label">{{ group.groupName }}</div>
        <div class="pills">
          <UiTag
            v-for="opt in group.options"
            :key="opt.optionId"
            size="small"
            :type="selectedModifiers[group.groupId] === opt.optionId ? 'primary' : 'default'"
            :secondary="selectedModifiers[group.groupId] !== opt.optionId"
            :hoverable="opt.active"
            :class="{ 'mod-opt-disabled': !opt.active }"
            round
            @click="opt.active && (selectedModifiers[group.groupId] = opt.optionId)"
          >
            {{ opt.optionName }}
            <template v-if="opt.priceDelta > 0"> +{{ opt.priceDelta }}₽</template>
            <span v-if="!opt.active" class="mod-unavailable">недоступно</span>
          </UiTag>
        </div>
      </div>

      <div v-for="ghost in ghostModifierGroups" :key="ghost.groupName" class="mod-group">
        <div class="section-label">{{ ghost.groupName }}</div>
        <div class="pills">
          <UiTag
            size="small"
            type="default"
            secondary
            round
          >
            {{ ghost.optionName }}
            <template v-if="ghost.priceDelta > 0"> +{{ ghost.priceDelta }}₽</template>
            <span class="mod-unavailable">удалено</span>
          </UiTag>
        </div>
      </div>

      <template v-if="showIngredients && removableIngredients.length">
        <div class="section-label">
          Ингредиенты <span class="section-hint">— нажмите, чтобы убрать или вернуть</span>
        </div>
        <div class="pills">
          <UiTag
            v-for="ing in removableIngredients"
            :key="ing.name"
            size="small"
            :type="removed[ing.name] ? 'error' : 'success'"
            secondary
            hoverable
            round
            @click="removed[ing.name] = !removed[ing.name]"
          >
            <UiIcon :name="removed[ing.name] ? 'minusRound' : 'checkRound'" :size="13" class="ing-icon" />
            {{ ing.name }}
          </UiTag>
        </div>
      </template>

      <template v-if="dishAddons.length || ghostAddons.length">
        <div class="section-label">Добавки</div>
        <div class="addon-list">
          <UiCheckbox
            v-for="addon in dishAddons"
            :key="addon.id"
            :model-value="selectedAddonIds.has(addon.id)"
            @update:model-value="selectedAddonIds.has(addon.id) ? selectedAddonIds.delete(addon.id) : selectedAddonIds.add(addon.id)"
          >
            {{ addon.name }}
            <span class="addon-price" :class="{ 'addon-price-active': selectedAddonIds.has(addon.id) }">+{{ addon.price }} ₽</span>
            <span v-if="addon.weight" class="addon-weight">{{ addon.weight }} г</span>
            <span v-if="!addon.active" class="addon-unavailable">недоступно</span>
          </UiCheckbox>
          <UiCheckbox
            v-for="addon in ghostAddons"
            :key="addon.addonId"
            :model-value="selectedAddonIds.has(addon.addonId)"
            @update:model-value="selectedAddonIds.has(addon.addonId) ? selectedAddonIds.delete(addon.addonId) : selectedAddonIds.add(addon.addonId)"
          >
            {{ addon.addonName }}
            <span class="addon-price" :class="{ 'addon-price-active': selectedAddonIds.has(addon.addonId) }">+{{ addon.price }} ₽</span>
            <span class="addon-unavailable">удалено</span>
          </UiCheckbox>
        </div>
      </template>

    </div>

    <template #footer>
      <div class="footer">
        <UiButton
          v-if="step === 'customize' && !editItem"
          type="text"
          icon="chevronLeft"
          @click="step = 'pick'"
        >
          Назад
        </UiButton>
        <div class="footer-right">
          <UiButton type="default" @click="$emit('update:modelValue', false)">Отмена</UiButton>
          <UiButton v-if="step === 'customize'" type="primary" @click="onConfirm">
            {{ editItem ? 'Сохранить' : 'Добавить' }}
          </UiButton>
        </div>
      </div>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, reactive, toRef, watch } from 'vue'
import { UiModal, UiButton, UiIcon, UiTag, UiCheckbox, UiInput, UiStepper } from '@fastio/ui'
import type { Combo, Dish, DishModifierGroup, OrderItemModifier, OrderItemAddon } from '@fastio/shared'
import type { Addon } from '@fastio/shared'
import { isAutoCategory } from '@fastio/shared'
import { useOrderDishPicker } from '~/composables/data/useOrderDishPicker'
import { useModules } from '~/composables/plan/useModules'
import { useTerms } from '~/composables/useTerms'

type PickerListItem = { type: 'dish'; data: Dish } | { type: 'combo'; data: Combo }

export type DishPickerResult = {
  dishId: string | null
  comboId: string | null
  dishName: string
  categoryName: string | null
  price: number
  quantity: number
  customizable: boolean
  modifierOptionIds: string[]
  modifiers: OrderItemModifier[]
  removedIngredients: string[]
  addons: OrderItemAddon[]
}

type EditItem = {
  dishId?: string | null
  comboId?: string | null
  modifiers?: { groupName: string; optionName: string; priceDelta: number }[]
  removedIngredients?: string[]
  addons?: OrderItemAddon[]
}

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  excludedDishIds?: string[]
  showCombos?: boolean
  showIngredients?: boolean
  editItem?: EditItem
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'select': [result: DishPickerResult]
}>()

const { loading, categories, allDishes, allCombos, fetchData, getDishModifiers, getDishAddons, listAddons } = useOrderDishPicker(toRef(props, 'tenantId'))
const modules = useModules()
const { item } = useTerms()

const step = ref<'pick' | 'customize'>('pick')
const selectedCatId = ref<string | null>(null)
const searchQuery = ref('')
const selectedDish = ref<Dish | null>(null)
const modifierGroups = ref<DishModifierGroup[]>([])
const selectedModifiers = reactive<Record<string, string>>({})
const removed = reactive<Record<string, boolean>>({})
const dishAddons = ref<Addon[]>([])
const ghostAddons = ref<OrderItemAddon[]>([])
const ghostModifierGroups = ref<OrderItemModifier[]>([])
const selectedAddonIds = reactive<Set<string>>(new Set())
const quantity = ref(1)
const isCustomizable = ref(false)
const dishQty = reactive<Record<string, number>>({})

// ─── Computed ─────────────────────────────────────────────────────────────────

const excluded = computed(() => new Set(props.excludedDishIds ?? []))

const availableCategories = computed(() => categories.value.filter(
  (c) => c.type === 'regular' && allDishes.value.some((d) => d.categoryId === c.id && !excluded.value.has(d.id)),
),
)

const currentDishes = computed(() => allDishes.value.filter((d) => d.categoryId === selectedCatId.value && !excluded.value.has(d.id)),
)

const searchResults = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()

  if (!q) return []

  return allDishes.value.filter((d) => !excluded.value.has(d.id) && d.name.toLowerCase().includes(q))
})

const removableIngredients = computed(() => selectedDish.value?.ingredients ?? [])

const displayItems = computed((): PickerListItem[] => {
  if (searchQuery.value) return searchResults.value.map((d) => ({ type: 'dish' as const, data: d }))
  if (selectedCatId.value === 'combos') return allCombos.value.map((c) => ({ type: 'combo' as const, data: c }))

  return currentDishes.value.map((d) => ({ type: 'dish' as const, data: d }))
})

const listEmptyMessage = computed(() => {
  if (displayItems.value.length) return null
  if (searchQuery.value) return 'Ничего не найдено'
  if (selectedCatId.value !== 'combos') return `Нет ${item.plural.gen}`

  return 'Нет комбо'
})

const modalTitle = computed(() => {
  if (step.value === 'pick') return `Выберите ${item.acc}`
  if (props.editItem) return 'Изменить состав'

  return selectedDish.value?.name ?? ''
})

// ─── Open ─────────────────────────────────────────────────────────────────────

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    step.value = 'pick'
    searchQuery.value = ''
    selectedDish.value = null
    modifierGroups.value = []
    ghostAddons.value = []
    ghostModifierGroups.value = []
    Object.keys(selectedModifiers).forEach((k) => delete selectedModifiers[k])
    Object.keys(removed).forEach((k) => delete removed[k])
    Object.keys(dishQty).forEach((k) => delete dishQty[k])
    quantity.value = 1
    isCustomizable.value = false

    if (!allDishes.value.length) await fetchData()

    const validCat = availableCategories.value.find((c) => c.id === selectedCatId.value)
    const validCombos = props.showCombos && allCombos.value.length > 0 && selectedCatId.value === 'combos'

    if (!validCat && !validCombos) {
      selectedCatId.value = props.showCombos && allCombos.value.length > 0
        ? 'combos'
        : availableCategories.value[0]?.id ?? null
    }

    if (props.editItem?.dishId) {
      const dish = allDishes.value.find((d) => d.id === props.editItem!.dishId)

      if (dish) await prefillDish(dish)
    }
  },
)

const loadDishData = async (dishId: string) => {
  const modifiersEnabled = modules.modifiers.value.enabled
  const addonsEnabled = modules.addons.value.enabled
  const [groups, addonIds, allAddons] = await Promise.all([
    modifiersEnabled ? getDishModifiers(dishId) : Promise.resolve([]),
    addonsEnabled ? getDishAddons(dishId) : Promise.resolve([]),
    addonsEnabled ? listAddons() : Promise.resolve([]),
  ])

  return { groups, addonIds, allAddons }
}

const prefillDish = async (dish: Dish) => {
  selectedDish.value = dish
  const { groups, addonIds, allAddons } = await loadDishData(dish.id)

  modifierGroups.value = groups
  const orderAddonIds = new Set(props.editItem?.addons?.map((a) => a.addonId) ?? [])

  dishAddons.value = allAddons.filter((a) => addonIds.includes(a.id) && (a.active || orderAddonIds.has(a.id)))
  const knownAddonIds = new Set(dishAddons.value.map((a) => a.id))

  ghostAddons.value = (props.editItem?.addons ?? []).filter((a) => !knownAddonIds.has(a.addonId))
  selectedAddonIds.clear()

  for (const group of modifierGroups.value) {
    const def = group.options.find((o) => o.isDefault) ?? group.options[0]

    if (def) selectedModifiers[group.groupId] = def.optionId
  }

  if (props.editItem?.modifiers?.length) {
    const matchedGroupNames = new Set<string>()

    for (const mod of props.editItem.modifiers) {
      for (const group of modifierGroups.value) {
        if (group.groupName === mod.groupName) {
          const opt = group.options.find((o) => o.optionName === mod.optionName)

          if (opt) {
            selectedModifiers[group.groupId] = opt.optionId
            matchedGroupNames.add(mod.groupName)
          }
        }
      }
    }

    ghostModifierGroups.value = props.editItem.modifiers.filter((m) => !matchedGroupNames.has(m.groupName))
  }

  props.editItem?.removedIngredients?.forEach((ing) => {
    removed[ing] = true
  })

  if (props.editItem?.addons?.length) {
    props.editItem.addons.forEach((a) => selectedAddonIds.add(a.addonId))
  }

  step.value = 'customize'
}

// ─── Select ───────────────────────────────────────────────────────────────────

const onSelectItem = (entry: PickerListItem) => {
  const qty = dishQty[entry.data.id] ?? 1

  if (entry.type === 'dish') selectDish(entry.data, qty)
  else selectCombo(entry.data, qty)
}

const selectDish = async (dish: Dish, qty = 1) => {
  selectedDish.value = dish
  quantity.value = qty
  Object.keys(selectedModifiers).forEach((k) => delete selectedModifiers[k])
  Object.keys(removed).forEach((k) => delete removed[k])
  selectedAddonIds.clear()

  const { groups, addonIds, allAddons } = await loadDishData(dish.id)

  modifierGroups.value = groups
    .map((g) => ({ ...g, options: g.options.filter((o) => o.active) }))
    .filter((g) => g.options.length > 0)
  dishAddons.value = allAddons.filter((a) => addonIds.includes(a.id) && a.active)

  for (const group of modifierGroups.value) {
    const def = group.options.find((o) => o.isDefault) ?? group.options[0]

    if (def) selectedModifiers[group.groupId] = def.optionId
  }

  const hasOptions = (props.showIngredients && removableIngredients.value.length > 0) || modifierGroups.value.length > 0 || dishAddons.value.length > 0

  isCustomizable.value = hasOptions

  if (hasOptions) {
    step.value = 'customize'
  } else {
    onConfirm()
  }
}

const selectCombo = (combo: Combo, qty = 1) => {
  emit('select', {
    dishId: null,
    comboId: combo.id,
    dishName: combo.name,
    categoryName: 'Комбо',
    price: combo.price,
    quantity: qty,
    customizable: false,
    modifierOptionIds: [],
    modifiers: [],
    removedIngredients: [],
    addons: [],
  })
  emit('update:modelValue', false)
}

const onConfirm = () => {
  if (!selectedDish.value) return

  const modifierOptionIds = Object.values(selectedModifiers)
  const modifiers: OrderItemModifier[] = modifierGroups.value.flatMap((group) => {
    const opt = group.options.find((o) => o.optionId === selectedModifiers[group.groupId])

    return opt ? [{ groupName: group.groupName, optionName: opt.optionName, priceDelta: opt.priceDelta }] : []
  })

  modifiers.push(...ghostModifierGroups.value)

  const removedIngredients = props.showIngredients
    ? removableIngredients.value.filter((i) => removed[i.name]).map((i) => i.name)
    : []

  const dishCategory = categories.value.find((c) => c.id === selectedDish.value!.categoryId)
  // Если категория виртуальная (tagId != null) — не используем её как categoryName,
  // т.к. блюдо туда попало по тегу, а не как родная категория
  const categoryName = dishCategory && !isAutoCategory(dishCategory) ? dishCategory.name : null

  const addons: OrderItemAddon[] = dishAddons.value
    .filter((a) => selectedAddonIds.has(a.id))
    .map((a) => {
      const original = props.editItem?.addons?.find((oa) => oa.addonId === a.id)

      return { addonId: a.id, addonName: a.name, price: original?.price ?? a.price }
    })

  for (const oa of ghostAddons.value) {
    if (selectedAddonIds.has(oa.addonId)) addons.push(oa)
  }

  emit('select', {
    dishId: selectedDish.value.id,
    comboId: null,
    dishName: selectedDish.value.name,
    categoryName,
    price: selectedDish.value.price,
    quantity: quantity.value,
    customizable: isCustomizable.value,
    modifierOptionIds,
    modifiers,
    removedIngredients,
    addons,
  })
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
// ── Шаг 1 ───────────────────────────────────────────────────────────────────

.pick-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  min-height: 400px;
}

.state {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  padding: var(--space-32) 0;
  text-align: center;
}

.cats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.cat {
  padding: var(--space-4) var(--space-12);
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border);
  background: transparent;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;

  &:hover {
    background: var(--color-bg-hover);
    color: var(--color-title);
  }

  &.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-white);
  }
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-height: 460px;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-8);
  background: transparent;
  border: 1px solid var(--color-border-light);
}

.item-controls {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-shrink: 0;
}

.item-photo {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-8);
  overflow: hidden;
  background: var(--color-bg-page);
}

.item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.item-no-photo {
  width: 100%;
  height: 100%;
  background: var(--color-border);
}

.item-name {
  flex: 1;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-price {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

// ── Шаг 2 ───────────────────────────────────────────────────────────────────

.customize-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  min-height: 120px;
}

.dish-summary {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-12);
  background: var(--color-bg-subtle);
  border-radius: var(--radius-12);
}

.summary-photo {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-8);
  overflow: hidden;
  background: var(--color-bg-page);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.summary-no-photo {
  width: 100%;
  height: 100%;
  background: var(--color-border);
}

.summary-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.summary-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
}

.summary-price {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.mod-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.section-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.section-hint {
  font-weight: var(--font-weight-regular);
  text-transform: none;
  letter-spacing: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.ing-icon {
  flex-shrink: 0;
  margin-right: var(--space-4);
}

.state-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.addon-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
}

.addon-price {
  margin-left: var(--space-8);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);

  &.addon-price-active {
    color: var(--color-success);
  }
}

.addon-weight {
  margin-left: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.addon-unavailable {
  margin-left: var(--space-8);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}

.mod-unavailable {
  margin-left: var(--space-4);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}

.mod-opt-disabled {
  opacity: 0.6;
  cursor: default;
}

// ── Footer ───────────────────────────────────────────────────────────────────

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: var(--space-8);
}

.footer-right {
  display: flex;
  gap: var(--space-8);
  margin-left: auto;
}
</style>
