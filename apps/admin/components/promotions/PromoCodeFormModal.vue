<template>
  <UiModal
    :model-value="modelValue"
    :title="promoCode ? 'Редактировать промокод' : 'Новый промокод'"
    :width="480"
    :actions="modalActions"
    :loading="saving"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <UiInput
        v-model="form.code"
        name="code"
        label="Код *"
        placeholder="SUMMER20"
        :rules="[{ type: 'required', message: 'Введите код' }]"
        style="text-transform: uppercase"
      />

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

      <UiInputNumber
        v-model="form.minOrderAmount"
        label="Минимальная сумма заказа"
        :min="0"
        placeholder="Без ограничений"
        :clearable="true"
      >
        <template #suffix>₽</template>
      </UiInputNumber>

      <UiInputNumber
        v-model="form.usageLimit"
        label="Лимит использований"
        :min="1"
        placeholder="Без ограничений"
        :clearable="true"
      />

      <div class="dates-row">
        <UiDatepicker v-model="form.activeFrom" label="Активен с" />
        <UiDatepicker v-model="form.activeTo" label="Активен до" />
      </div>

      <div class="switch-row">
        <UiSwitch v-model="form.active" label="Активен" />
      </div>
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiInputNumber, UiSwitch, UiRadioGroup, UiDatepicker } from '@fastio/ui'
import type { PromoCode, PromoCodeFormData } from '@fastio/shared'

const props = defineProps<{
  modelValue: boolean
  promoCode: PromoCode | null
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: PromoCodeFormData]
}>()

const formRef = ref()

const discountTypeOptions = [
  { value: 'percent', label: 'Процент (%)' },
  { value: 'fixed', label: 'Фиксированная сумма (₽)' },
]

const modalActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: props.saving },
])

type FormState = Omit<PromoCodeFormData, 'activeFrom' | 'activeTo'> & {
  activeFrom: number | null
  activeTo: number | null
}

const defaultForm = (): FormState => ({
  code: '',
  discountType: 'percent',
  discountValue: 10,
  minOrderAmount: null,
  usageLimit: null,
  activeFrom: null,
  activeTo: null,
  active: true,
})

const form = reactive(defaultForm())

const isoToTs = (iso: string | null): number | null => iso ? new Date(iso).getTime() : null

const tsToIso = (ts: number | null): string | null => ts ? new Date(ts).toISOString() : null

watch(
  () => props.modelValue,
  (val) => {
    if (!val) return
    if (props.promoCode) {
      form.code = props.promoCode.code
      form.discountType = props.promoCode.discountType
      form.discountValue = props.promoCode.discountValue
      form.minOrderAmount = props.promoCode.minOrderAmount
      form.usageLimit = props.promoCode.usageLimit
      form.activeFrom = isoToTs(props.promoCode.activeFrom)
      form.activeTo = isoToTs(props.promoCode.activeTo)
      form.active = props.promoCode.active
    } else {
      Object.assign(form, defaultForm())
    }
  },
)

const onConfirm = () => {
  if (!formRef.value?.validate()) return false

  emit('save', {
    code: form.code,
    discountType: form.discountType,
    discountValue: form.discountValue,
    minOrderAmount: form.minOrderAmount ?? null,
    usageLimit: form.usageLimit ?? null,
    activeFrom: tsToIso(form.activeFrom),
    activeTo: tsToIso(form.activeTo),
    active: form.active,
  })

  return false
}
</script>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dates-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.switch-row {
  align-self: flex-start;
}
</style>
