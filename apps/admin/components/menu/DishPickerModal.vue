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
        <UiInput v-model="searchQuery" placeholder="Поиск блюда…" clearable />

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
          <template v-if="searchQuery">
            <div v-if="!searchResults.length" class="state">Ничего не найдено</div>
            <button
              v-for="dish in searchResults"
              :key="dish.id"
              class="item"
              @click="selectDish(dish)"
            >
              <div class="item-photo">
                <img
                  v-if="dish.photos[0]"
                  :src="dish.photos[0]"
                  :alt="dish.name"
                  class="item-img"
                />
                <div v-else class="item-no-photo" />
              </div>
              <span class="item-name">{{ dish.name }}</span>
              <span class="item-price">{{ dish.price }} ₽</span>
              <UiIcon name="chevronRight" :size="14" class="item-arrow" />
            </button>
          </template>
          <template v-else-if="selectedCatId === 'combos'">
            <button
              v-for="combo in allCombos"
              :key="combo.id"
              class="item"
              @click="selectCombo(combo)"
            >
              <div class="item-photo">
                <img
                  v-if="combo.photos[0]"
                  :src="combo.photos[0]"
                  :alt="combo.name"
                  class="item-img"
                />
                <div v-else class="item-no-photo" />
              </div>
              <span class="item-name">{{ combo.name }}</span>
              <span class="item-price">{{ combo.price }} ₽</span>
              <UiIcon name="chevronRight" :size="14" class="item-arrow" />
            </button>
          </template>
          <template v-else>
            <div v-if="!currentDishes.length" class="state">Нет блюд</div>
            <button
              v-for="dish in currentDishes"
              :key="dish.id"
              class="item"
              @click="selectDish(dish)"
            >
              <div class="item-photo">
                <img
                  v-if="dish.photos[0]"
                  :src="dish.photos[0]"
                  :alt="dish.name"
                  class="item-img"
                />
                <div v-else class="item-no-photo" />
              </div>
              <span class="item-name">{{ dish.name }}</span>
              <span class="item-price">{{ dish.price }} ₽</span>
              <UiIcon name="chevronRight" :size="14" class="item-arrow" />
            </button>
          </template>
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
            hoverable
            round
            @click="selectedModifiers[group.groupId] = opt.optionId"
          >
            {{ opt.optionName }}
            <template v-if="opt.priceDelta > 0"> +{{ opt.priceDelta }}₽</template>
          </UiTag>
        </div>
      </div>

      <template v-if="showIngredients && removableIngredients.length">
        <div class="section-label">
          Состав <span class="section-hint">— нажмите, чтобы убрать или вернуть</span>
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

      <div v-else-if="showIngredients" class="state-hint">Ингредиенты не заданы</div>

      <template v-if="dishAddons.length">
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
        </div>
      </template>
    </div>

    <template #footer>
      <div class="footer">
        <UiButton
          v-if="step === 'customize'"
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
import { UiModal, UiButton, UiIcon, UiTag, UiCheckbox, UiInput } from '@fastio/ui'
import type { Combo, Dish, DishModifierGroup, OrderItemModifier, OrderItemAddon } from '@fastio/shared'
import type { Addon } from '@fastio/shared'
import { useOrderDishPicker } from '~/composables/data/useOrderDishPicker'

export type DishPickerResult = {
  dishId: string | null
  comboId: string | null
  dishName: string
  categoryName: string | null
  price: number
  modifierOptionIds: string[]
  modifiers: OrderItemModifier[]
  removedIngredients: string[]
  addons: OrderItemAddon[]
}

type EditItem = {
  dishId?: string | null
  comboId?: string | null
  modifiers?: { groupName: string; optionName: string }[]
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

const step = ref<'pick' | 'customize'>('pick')
const selectedCatId = ref<string | null>(null)
const searchQuery = ref('')
const selectedDish = ref<Dish | null>(null)
const modifierGroups = ref<DishModifierGroup[]>([])
const selectedModifiers = reactive<Record<string, string>>({})
const removed = reactive<Record<string, boolean>>({})
const dishAddons = ref<Addon[]>([])
const selectedAddonIds = reactive<Set<string>>(new Set())

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

const removableIngredients = computed(() => selectedDish.value?.ingredients.filter((i) => i.removable) ?? [])

const modalTitle = computed(() => {
  if (step.value === 'pick') return 'Выберите блюдо'
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
    Object.keys(selectedModifiers).forEach((k) => delete selectedModifiers[k])
    Object.keys(removed).forEach((k) => delete removed[k])

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

const prefillDish = async (dish: Dish) => {
  selectedDish.value = dish
  const [groups, addonIds, allAddons] = await Promise.all([
    getDishModifiers(dish.id),
    getDishAddons(dish.id),
    listAddons(),
  ])

  modifierGroups.value = groups
  const orderAddonIds = new Set(props.editItem?.addons?.map((a) => a.addonId) ?? [])

  dishAddons.value = allAddons.filter((a) => addonIds.includes(a.id) && (a.active || orderAddonIds.has(a.id)))
  selectedAddonIds.clear()

  for (const group of modifierGroups.value) {
    const def = group.options.find((o) => o.isDefault) ?? group.options[0]

    if (def) selectedModifiers[group.groupId] = def.optionId
  }

  if (props.editItem?.modifiers?.length) {
    for (const mod of props.editItem.modifiers) {
      for (const group of modifierGroups.value) {
        if (group.groupName === mod.groupName) {
          const opt = group.options.find((o) => o.optionName === mod.optionName)

          if (opt) selectedModifiers[group.groupId] = opt.optionId
        }
      }
    }
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

const selectDish = async (dish: Dish) => {
  selectedDish.value = dish
  Object.keys(selectedModifiers).forEach((k) => delete selectedModifiers[k])
  Object.keys(removed).forEach((k) => delete removed[k])
  selectedAddonIds.clear()

  const [groups, addonIds, allAddons] = await Promise.all([
    getDishModifiers(dish.id),
    getDishAddons(dish.id),
    listAddons(),
  ])

  modifierGroups.value = groups
  dishAddons.value = allAddons.filter((a) => addonIds.includes(a.id) && a.active)

  for (const group of modifierGroups.value) {
    const def = group.options.find((o) => o.isDefault) ?? group.options[0]

    if (def) selectedModifiers[group.groupId] = def.optionId
  }

  if (props.showIngredients || modifierGroups.value.length > 0 || dishAddons.value.length > 0) {
    step.value = 'customize'
  } else {
    onConfirm()
  }
}

const selectCombo = (combo: Combo) => {
  emit('select', {
    dishId: null,
    comboId: combo.id,
    dishName: combo.name,
    categoryName: 'Комбо',
    price: combo.price,
    modifierOptionIds: [],
    modifiers: [],
    removedIngredients: [],
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

  const removedIngredients = props.showIngredients
    ? removableIngredients.value.filter((i) => removed[i.name]).map((i) => i.name)
    : []

  const categoryName = categories.value.find((c) => c.id === selectedDish.value!.categoryId)?.name ?? null

  const addons: OrderItemAddon[] = dishAddons.value
    .filter((a) => selectedAddonIds.has(a.id))
    .map((a) => {
      const original = props.editItem?.addons?.find((oa) => oa.addonId === a.id)

      return { addonId: a.id, addonName: a.name, price: original?.price ?? a.price }
    })

  emit('select', {
    dishId: selectedDish.value.id,
    comboId: null,
    dishName: selectedDish.value.name,
    categoryName,
    price: selectedDish.value.price,
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
  gap: 12px;
  min-height: 400px;
}

.state {
  font-size: 13px;
  color: var(--color-text-tertiary);
  padding: 40px 0;
  text-align: center;
}

.cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cat {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--color-border);
  background: transparent;
  font-size: 13px;
  font-weight: 500;
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
    color: #fff;
  }
}

.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 460px;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.1s, border-color 0.1s;

  &:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-border);
  }
}

.item-photo {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 8px;
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
  font-size: 15px;
  font-weight: 600;
  color: var(--color-title);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-price {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.item-arrow {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

// ── Шаг 2 ───────────────────────────────────────────────────────────────────

.customize-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 120px;
}

.dish-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-bg-subtle);
  border-radius: 12px;
}

.summary-photo {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 10px;
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
  gap: 4px;
}

.summary-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-title);
}

.summary-price {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.mod-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.section-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ing-icon {
  flex-shrink: 0;
  margin-right: 4px;
}

.state-hint {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.addon-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.addon-price {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);

  &.addon-price-active {
    color: var(--color-success);
  }
}

.addon-weight {
  margin-left: 4px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.addon-unavailable {
  margin-left: 6px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-style: italic;
}

// ── Footer ───────────────────────────────────────────────────────────────────

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}

.footer-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
