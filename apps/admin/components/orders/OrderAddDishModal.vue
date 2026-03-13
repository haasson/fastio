<template>
  <UiModal
    :model-value="modelValue"
    :title="modalTitle"
    :width="500"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- ── Шаг 1: выбор блюда ────────────────────────────────────────────── -->
    <div v-if="step === 'pick'" class="pick-content">
      <!-- Категории -->
      <div v-if="loading" class="state-msg">Загрузка…</div>
      <template v-else>
        <div class="cat-tabs">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="cat-tab"
            :class="{ active: selectedCategoryId === cat.id }"
            @click="selectedCategoryId = cat.id"
          >
            {{ cat.name }}
          </button>
        </div>

        <!-- Список блюд -->
        <div class="dish-list">
          <div v-if="!categoryDishes.length" class="state-msg">Нет блюд</div>
          <button
            v-for="dish in categoryDishes"
            :key="dish.id"
            class="dish-row"
            @click="selectDish(dish)"
          >
            <div class="dish-photo">
              <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" />
              <span v-else class="photo-placeholder">🍽</span>
            </div>
            <span class="dish-name">{{ dish.name }}</span>
            <span class="dish-price">{{ dish.price }} ₽</span>
            <UiIcon name="chevronRight" :size="14" class="arrow" />
          </button>
        </div>
      </template>
    </div>

    <!-- ── Шаг 2: кастомизация ───────────────────────────────────────────── -->
    <div v-else-if="step === 'customize' && selectedDish" class="customize-content">
      <div class="dish-summary">
        <div class="summary-photo">
          <img v-if="selectedDish.photos[0]" :src="selectedDish.photos[0]" :alt="selectedDish.name" />
          <span v-else class="photo-placeholder">🍽</span>
        </div>
        <div class="summary-info">
          <span class="summary-name">{{ selectedDish.name }}</span>
          <span class="summary-price">{{ selectedDish.price }} ₽</span>
        </div>
      </div>

      <!-- Модификаторы -->
      <template v-if="dishModifierGroups.length">
        <div v-for="group in dishModifierGroups" :key="group.groupId" class="modifier-section">
          <div class="section-label">{{ group.groupName }}</div>
          <div class="modifier-pills">
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
      </template>

      <template v-if="removableIngredients.length">
        <div class="section-label">Состав <span class="section-hint">— нажмите, чтобы убрать</span></div>
        <div class="ingredients">
          <UiTag
            v-for="ing in removableIngredients"
            :key="ing.name"
            size="small"
            :type="removed[ing.name] ? 'default' : 'success'"
            secondary
            hoverable
            round
            @click="removed[ing.name] = !removed[ing.name]"
          >
            <UiIcon
              :name="removed[ing.name] ? 'minusRound' : 'checkRound'"
              :size="13"
              class="ing-icon"
            />{{ ing.name }}
          </UiTag>
        </div>
      </template>

      <div v-else class="no-ingredients">Ингредиенты не заданы</div>
    </div>

    <template #footer>
      <div class="footer-actions">
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
          <UiButton
            v-if="step === 'customize'"
            type="primary"
            @click="onConfirm"
          >
            {{ editItem ? 'Сохранить' : 'Добавить' }}
          </UiButton>
        </div>
      </div>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, toRefs, reactive, watch } from 'vue'
import { UiModal, UiButton, UiIcon, UiTag } from '@fastio/ui'
import type { Dish, OrderItem, DishModifierGroup, OrderItemModifier } from '@fastio/shared'
import { useOrderDishPicker } from '~/composables/data/useOrderDishPicker'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  editItem?: OrderItem
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'add': [item: OrderItem]
  'update': [item: OrderItem]
}>()

const { tenantId: tenantIdRef } = toRefs(props)
const { loading, categories, allDishes, fetchData, getDishModifiers } = useOrderDishPicker(tenantIdRef)

const selectedCategoryId = ref<string | null>(null)
const selectedDish = ref<Dish | null>(null)
const removed = reactive<Record<string, boolean>>({})
const step = ref<'pick' | 'customize'>('pick')

// Modifiers
const dishModifierGroups = ref<DishModifierGroup[]>([])
const selectedModifiers = reactive<Record<string, string>>({})

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    step.value = 'pick'
    selectedDish.value = null
    selectedCategoryId.value = null
    dishModifierGroups.value = []
    Object.keys(removed).forEach((k) => delete removed[k])
    Object.keys(selectedModifiers).forEach((k) => delete selectedModifiers[k])
    if (!allDishes.value.length) await fetchData()

    if (props.editItem) {
      const dish = allDishes.value.find((d) => d.id === props.editItem!.dishId)

      if (dish) {
        selectedDish.value = dish
        props.editItem.removedIngredients.forEach((ing) => {
          removed[ing] = true
        })
        await loadDishModifiers(dish.id)
        // Restore selected modifiers from editItem
        if (props.editItem.modifiers?.length) {
          for (const mod of props.editItem.modifiers) {
            for (const group of dishModifierGroups.value) {
              if (group.groupName === mod.groupName) {
                const opt = group.options.find((o) => o.optionName === mod.optionName)

                if (opt) selectedModifiers[group.groupId] = opt.optionId
              }
            }
          }
        }
        step.value = 'customize'
      }
    } else if (!selectedCategoryId.value && categories.value.length) {
      selectedCategoryId.value = categories.value[0].id
    }
  },
)

const loadDishModifiers = async (dishId: string) => {
  dishModifierGroups.value = await getDishModifiers(dishId)
  // Set defaults
  for (const group of dishModifierGroups.value) {
    const defaultOpt = group.options.find((o) => o.isDefault) ?? group.options[0]

    if (defaultOpt && !selectedModifiers[group.groupId]) {
      selectedModifiers[group.groupId] = defaultOpt.optionId
    }
  }
}

const modalTitle = computed(() => {
  if (step.value === 'pick') return 'Добавить блюдо'
  if (props.editItem) return 'Изменить состав'

  return selectedDish.value?.name ?? ''
})

const categoryDishes = computed(() => allDishes.value.filter((d) => d.categoryId === selectedCategoryId.value),
)

const removableIngredients = computed(() => selectedDish.value?.ingredients.filter((i) => i.removable) ?? [],
)

const selectDish = async (dish: Dish) => {
  selectedDish.value = dish
  Object.keys(removed).forEach((k) => delete removed[k])
  Object.keys(selectedModifiers).forEach((k) => delete selectedModifiers[k])
  await loadDishModifiers(dish.id)
  step.value = 'customize'
}

const onConfirm = () => {
  if (!selectedDish.value) return

  const removedIngredients = removableIngredients.value
    .filter((i) => removed[i.name])
    .map((i) => i.name)

  const categoryName = categories.value.find((c) => c.id === selectedDish.value!.categoryId)?.name ?? null

  // Build modifiers snapshot
  const modifiers: OrderItemModifier[] = []

  for (const group of dishModifierGroups.value) {
    const selectedId = selectedModifiers[group.groupId]
    const opt = group.options.find((o) => o.optionId === selectedId)

    if (opt) {
      modifiers.push({
        groupName: group.groupName,
        optionName: opt.optionName,
        priceDelta: opt.priceDelta,
      })
    }
  }

  const item: OrderItem = {
    dishId: selectedDish.value.id,
    dishName: selectedDish.value.name,
    categoryName,
    price: selectedDish.value.price,
    quantity: props.editItem?.quantity ?? 1,
    removedIngredients,
    modifiers,
  }

  if (props.editItem) {
    emit('update', item)
  } else {
    emit('add', item)
  }
}
</script>

<style scoped lang="scss">
// ── Шаг 1 ──────────────────────────────────────────────────────────────────

.pick-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 300px;
}

.cat-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cat-tab {
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

.dish-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  overflow-y: auto;
}

.dish-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
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

.dish-photo {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 8px;
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
  font-size: 20px;
}

.dish-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dish-price {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.arrow {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

// ── Шаг 2 ──────────────────────────────────────────────────────────────────

.customize-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 180px;
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
  width: 56px;
  height: 56px;
  border-radius: 10px;
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
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary);
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

.ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ing-icon {
  flex-shrink: 0;
  margin-right: 4px;
}

.modifier-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modifier-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.no-ingredients {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

// ── Footer ──────────────────────────────────────────────────────────────────

.state-msg {
  font-size: 13px;
  color: var(--color-text-tertiary);
  padding: 40px 0;
  text-align: center;
}

.footer-actions {
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
