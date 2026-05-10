<template>
  <UiModal
    :model-value="modelValue"
    :title="promotion ? 'Редактировать акцию' : 'Новая акция'"
    :width="500"
    :actions="modalActions"
    :loading="saving"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <UiInput
        v-model="form.title"
        name="title"
        label="Название *"
        placeholder="Скидка в обед"
        :rules="[{ type: 'required', message: 'Введите название' }]"
      />

      <UiSelect
        v-model:value="form.type"
        label="Тип акции"
        :options="typeOptions"
      />

      <!-- Условия по типу -->
      <UiInputNumber
        v-if="showMinOrderField"
        v-model="form.conditions.minOrderAmount"
        name="minOrderAmount"
        :label="minOrderRequired ? 'Минимальная сумма заказа *' : 'Минимальная сумма заказа'"
        :min="0"
        :rules="minOrderRules"
      >
        <template #suffix>₽</template>
      </UiInputNumber>

      <div v-if="form.type === 'happy_hour'" class="time-row">
        <UiTimepicker v-model="form.conditions.timeFrom" label="С *" />
        <UiTimepicker v-model="form.conditions.timeTo" label="До *" />
      </div>

      <div v-if="form.type === 'weekday'" class="weekdays">
        <span class="weekdays-label">Дни недели *</span>
        <div class="weekday-buttons">
          <button
            v-for="day in weekdays"
            :key="day.value"
            type="button"
            class="weekday-btn"
            :class="{ active: form.conditions.weekdays?.includes(day.value) }"
            @click="toggleWeekday(day.value)"
          >
            {{ day.label }}
          </button>
        </div>
      </div>

      <div v-if="form.type === 'free_item'" class="free-item">
        <UiInputNumber
          v-model="form.conditions.minOrderAmount"
          label="Минимальная сумма заказа"
          :min="0"
        >
          <template #suffix>₽</template>
        </UiInputNumber>

        <div class="dish-select">
          <span class="dish-select-label">Блюдо в подарок *</span>
          <ul v-if="form.conditions.freeDishId" class="dish-list">
            <DishItemRow
              :name="form.conditions.freeDishName ?? ''"
              :category-name="form.conditions.freeDishCategoryName"
              :modifiers="form.conditions.freeDishModifiers?.map(m => ({ name: m.optionName, priceDelta: m.priceDelta }))"
            >
              <UiButton
                type="text"
                size="small"
                icon="close"
                @click="clearFreeDish"
              />
            </DishItemRow>
          </ul>
          <UiButton
            v-else
            type="default"
            icon="plus"
            size="small"
            @click="showDishPicker = true"
          >
            Выбрать блюдо
          </UiButton>
        </div>
      </div>

      <div v-if="form.type === 'first_order'" class="first-order-notice">
        <UiAlert type="warning">
          Скидка на первый заказ будет доступна после добавления базы гостей (CRM)
        </UiAlert>
      </div>

      <!-- Скидка — не применима к free_item -->
      <template v-if="form.type !== 'free_item'">
        <UiRadioGroup
          v-model="form.discountType"
          label="Тип скидки"
          :options="discountTypeOptions"
        />

        <UiInputNumber
          v-model="form.discountValue"
          name="discountValue"
          label="Размер скидки *"
          :min="0"
          :max="form.discountType === 'percent' ? 100 : undefined"
        >
          <template #suffix>{{ form.discountType === 'percent' ? '%' : '₽' }}</template>
        </UiInputNumber>
      </template>

      <!-- Период -->
      <div class="dates-row">
        <UiDatepicker v-model="form.activeFrom" label="Активна с" />
        <UiDatepicker v-model="form.activeTo" label="Активна до" />
      </div>

      <UiSwitch v-model="form.active" label="Активна" />
    </UiForm>

    <DishPickerModal
      v-model="showDishPicker"
      :tenant-id="tenantId"
      :show-combos="false"
      :show-ingredients="false"
      @select="onDishSelected"
    />
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { UiModal, UiForm, UiInput, UiInputNumber, UiSwitch, UiRadioGroup, UiSelect, UiDatepicker, UiTimepicker, UiAlert, UiButton } from '@fastio/ui'
import type { Promotion, PromotionFormData, PromotionConditions } from '@fastio/shared'
import type { ValidationRule } from '@fastio/kit'
import { isoToTs, tsToIso, tsToIsoEndOfDay } from '@fastio/shared'
import DishPickerModal, { type DishPickerResult } from '~/features/menu/components/DishPickerModal.vue'
import DishItemRow from '~/shared/ui/components/DishItemRow.vue'

const props = defineProps<{
  modelValue: boolean
  promotion: Promotion | null
  tenantId: string
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: PromotionFormData]
}>()

const formRef = ref()

const typeOptions = [
  { value: 'min_order', label: 'Скидка от суммы заказа' },
  { value: 'happy_hour', label: 'Happy hour (по времени)' },
  { value: 'weekday', label: 'По дням недели' },
  { value: 'free_item', label: 'Блюдо в подарок', disabled: true },
  { value: 'first_order', label: 'На первый заказ', disabled: true },
]

const discountTypeOptions = [
  { value: 'percent', label: 'Процент (%)' },
  { value: 'fixed', label: 'Фиксированная сумма (₽)' },
]

const showMinOrderField = computed(() => ['min_order', 'happy_hour', 'weekday'].includes(form.type))

const minOrderRequired = computed(() => form.discountType === 'fixed')

const minOrderRules = computed<ValidationRule[]>(() => {
  if (form.discountType !== 'fixed') return []

  return [
    { type: 'required', message: 'Укажите минимальную сумму заказа' },
    {
      type: 'custom',
      validator: (v: number | null) => v !== null && v !== undefined && v >= form.discountValue,
      message: `Минимальная сумма должна быть не меньше размера скидки (${form.discountValue}₽)`,
    },
  ]
})

const weekdays = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
]

const modalActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: props.saving },
])

type FormState = Omit<PromotionFormData, 'activeFrom' | 'activeTo' | 'conditions'> & {
  conditions: PromotionConditions & { timeFrom?: string | null; timeTo?: string | null }
  activeFrom: number | null
  activeTo: number | null
}

const defaultForm = (): FormState => ({
  title: '',
  type: 'min_order',
  discountType: 'percent',
  discountValue: 10,
  conditions: { minOrderAmount: 0 },
  activeFrom: null,
  activeTo: null,
  active: true,
})

const form = reactive(defaultForm())
let initializing = false

watch(
  () => props.modelValue,
  async (val) => {
    if (!val) return
    initializing = true
    if (props.promotion) {
      form.title = props.promotion.title
      form.type = props.promotion.type
      form.discountType = props.promotion.discountType
      form.discountValue = props.promotion.discountValue
      form.conditions = { ...props.promotion.conditions }
      form.activeFrom = isoToTs(props.promotion.activeFrom)
      form.activeTo = isoToTs(props.promotion.activeTo)
      form.active = props.promotion.active
    } else {
      Object.assign(form, defaultForm())
    }
    await nextTick()
    initializing = false
  },
)

watch(() => form.type, () => {
  if (initializing) return
  form.conditions = { minOrderAmount: 0 }
})

const toggleWeekday = (day: number) => {
  const days = form.conditions.weekdays ?? []

  form.conditions.weekdays = days.includes(day)
    ? days.filter((d) => d !== day)
    : [...days, day].sort()
}

const showDishPicker = ref(false)

const onDishSelected = (result: DishPickerResult) => {
  form.conditions.freeDishId = result.dishId ?? undefined
  form.conditions.freeDishName = result.dishName
  form.conditions.freeDishCategoryName = result.categoryName ?? undefined
  form.conditions.freeDishModifiers = result.modifiers.length ? result.modifiers : undefined
  showDishPicker.value = false
}

const clearFreeDish = () => {
  form.conditions.freeDishId = undefined
  form.conditions.freeDishName = undefined
  form.conditions.freeDishCategoryName = undefined
  form.conditions.freeDishModifiers = undefined
}

const buildConditions = (): PromotionConditions => {
  if (form.type === 'min_order') return { minOrderAmount: form.conditions.minOrderAmount }
  if (form.type === 'happy_hour') return { timeFrom: form.conditions.timeFrom ?? undefined, timeTo: form.conditions.timeTo ?? undefined, minOrderAmount: form.conditions.minOrderAmount || undefined }
  if (form.type === 'weekday') return { weekdays: form.conditions.weekdays, minOrderAmount: form.conditions.minOrderAmount || undefined }
  if (form.type === 'free_item') return { minOrderAmount: form.conditions.minOrderAmount, freeDishId: form.conditions.freeDishId, freeDishName: form.conditions.freeDishName, freeDishCategoryName: form.conditions.freeDishCategoryName, freeDishModifiers: form.conditions.freeDishModifiers }

  return {}
}

const onConfirm = () => {
  if (!formRef.value?.validate()) return false

  emit('save', {
    title: form.title,
    type: form.type,
    discountType: form.discountType,
    discountValue: form.discountValue,
    conditions: buildConditions(),
    activeFrom: tsToIso(form.activeFrom),
    activeTo: tsToIsoEndOfDay(form.activeTo),
    active: form.active,
  })

  return false
}
</script>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.time-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
}

.dates-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
}

.weekdays-label {
  display: block;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-8);
}

.weekday-buttons {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.free-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.dish-select-label {
  display: block;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-8);
}

.dish-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  overflow: hidden;
}

.weekday-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-8);
  border: 1.5px solid var(--color-border);
  background: none;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;

  &:hover {
    border-color: var(--color-primary);
  }

  &.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-white);
  }
}
</style>
