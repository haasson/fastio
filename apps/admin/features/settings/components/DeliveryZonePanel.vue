<template>
  <div class="zone-panel-root">
    <div class="zone-panel-header">
      <UiText size="medium" weight="bold">{{ zoneId ? 'Редактирование' : 'Новая зона' }}</UiText>
      <UiButton
        type="text"
        size="small"
        icon="close"
        @click="$emit('close')"
      />
    </div>

    <UiForm ref="formRef" class="zone-form">
      <UiSelect
        v-if="branchOptions.length > 1"
        v-model:value="form.branchId"
        :options="branchOptions"
        label="Филиал"
      />

      <UiInput
        v-model="form.name"
        name="name"
        label="Название зоны"
        placeholder="Центр города"
        :rules="nameRules"
      />

      <UiColorPicker v-model="form.color" label="Цвет зоны" />

      <UiInputNumber
        v-model="form.deliveryFee"
        label="Стоимость доставки"
        placeholder="0"
        :min="0"
      >
        <template #suffix>₽</template>
      </UiInputNumber>
      <UiInputNumber
        v-model="form.minOrder"
        label="Минимальный заказ"
        placeholder="0"
        :min="0"
      >
        <template #suffix>₽</template>
      </UiInputNumber>

      <div class="free-delivery-block">
        <div class="free-delivery-toggle">
          <UiText size="small">Бесплатная доставка от суммы</UiText>
          <UiSwitch v-model="enableFreeDelivery" />
        </div>
        <UiInputNumber
          v-if="enableFreeDelivery"
          v-model="form.freeDeliveryFrom"
          label="Сумма заказа"
          :min="1"
          :rules="freeDeliveryRules"
        >
          <template #suffix>₽</template>
        </UiInputNumber>
      </div>

      <UiSpace :size="10">
        <UiButton
          type="primary"
          :loading="saving"
          @click="onSave"
        >
          Сохранить
        </UiButton>
        <UiButton
          v-if="zoneId"
          type="error"
          :loading="removing"
          @click="$emit('remove')"
        >
          Удалить
        </UiButton>
      </UiSpace>
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ValidationRule } from '@fastio/kit'
import {
  UiText, UiButton, UiInput, UiInputNumber,
  UiSpace, UiSelect, UiForm, UiSwitch,
} from '@fastio/ui'
import type { DeliveryZone } from '@fastio/shared'
import UiColorPicker from '~/shared/ui/components/ColorPicker.vue'

type ZoneForm = {
  branchId: string
  name: string
  color: string
  deliveryFee: number | null
  minOrder: number | null
  freeDeliveryFrom: number | null
  coordinates: [number, number][]
}

const props = defineProps<{
  form: ZoneForm
  zoneId?: string
  branchOptions: { label: string; value: string }[]
  existingZones: DeliveryZone[]
  saving: boolean
  removing: boolean
}>()

const emit = defineEmits<{
  close: []
  save: []
  remove: []
}>()

const formRef = ref()

const enableFreeDelivery = ref((props.form.freeDeliveryFrom ?? 0) > 0)

watch(enableFreeDelivery, (enabled) => {
  if (!enabled) props.form.freeDeliveryFrom = null
})

const nameRules = computed<ValidationRule[]>(() => [
  { type: 'required', message: 'Введите название зоны' },
  {
    type: 'custom',
    validator: (value: string) => {
      const name = (value || '').trim()
      const duplicate = props.existingZones.find(
        (z) => z.name.toLowerCase() === name.toLowerCase() && z.id !== props.zoneId,
      )

      return !duplicate
    },
    message: 'Зона с таким названием уже существует',
  },
])

const freeDeliveryRules: ValidationRule[] = [
  { type: 'required', message: 'Введите сумму' },
  {
    type: 'custom',
    validator: (value: number | null) => (value ?? 0) >= 1,
    message: 'Сумма должна быть больше 0',
  },
]

const onSave = () => {
  if (!formRef.value?.validate()) return
  emit('save')
}
</script>

<style scoped lang="scss">
.zone-panel-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.zone-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.zone-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.free-delivery-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.free-delivery-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-8) 0;
  border-top: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
}
</style>
