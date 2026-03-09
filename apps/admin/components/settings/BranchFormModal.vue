<template>
  <UiModal
    :model-value="modelValue"
    :title="branch ? 'Редактировать филиал' : 'Новый филиал'"
    :width="520"
    :actions="modalActions"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <UiSectionHeader title="Основное" />

      <UiInput
        v-model="form.name"
        name="name"
        label="Название *"
        placeholder="Центральный"
        :rules="[{ type: 'required', message: 'Введите название' }]"
      />
      <UiInput v-model="form.address" label="Адрес" placeholder="ул. Ленина, 1" />
      <UiInput
        v-model="form.phone"
        label="Телефон"
        placeholder="+7 (900) 000-00-00"
        :rules="[{ type: 'phone', message: 'Введите корректный телефон' }]"
      />

      <div class="active-row">
        <UiText size="small">Филиал активен</UiText>
        <UiSwitch v-model="form.isActive" />
      </div>

      <!-- Часы работы -->
      <div class="override-block">
        <UiSectionHeader title="Часы работы">
          <template #right>
            <div class="override-toggle">
              <UiText size="tiny">Своё расписание</UiText>
              <UiSwitch :model-value="useCustomHours" @update:model-value="toggleCustomHours" />
            </div>
          </template>
        </UiSectionHeader>

        <UiInput
          v-if="useCustomHours"
          v-model="form.workingHours"
          label="Режим работы"
          type="textarea"
          :rows="2"
          placeholder="Пн–Пт 10:00–22:00, Сб–Вс 11:00–21:00"
        />
        <UiText v-else size="small" class="inherit-hint">Используются общие настройки</UiText>
      </div>

      <!-- Доставка -->
      <div class="override-block">
        <UiSectionHeader title="Доставка">
          <template #right>
            <div class="override-toggle">
              <UiText size="tiny">Свои условия</UiText>
              <UiSwitch :model-value="useCustomDelivery" @update:model-value="toggleCustomDelivery" />
            </div>
          </template>
        </UiSectionHeader>

        <template v-if="useCustomDelivery">
          <div class="delivery-row">
            <UiInputNumber
              v-model="form.deliveryMinOrder"
              label="Мин. заказ, ₽"
              :min="0"
              placeholder="500"
            />
            <UiInputNumber
              v-model="form.deliveryFee"
              label="Стоимость доставки, ₽"
              :min="0"
              placeholder="150"
            />
          </div>
        </template>
        <UiText v-else size="small" class="inherit-hint">Используются общие настройки</UiText>
      </div>

      <!-- Уведомления -->
      <div class="override-block">
        <UiSectionHeader title="Уведомления">
          <template #right>
            <div class="override-toggle">
              <UiText size="tiny">Свои уведомления</UiText>
              <UiSwitch :model-value="useCustomNotifications" @update:model-value="toggleCustomNotifications" />
            </div>
          </template>
        </UiSectionHeader>

        <template v-if="useCustomNotifications && form.notifications">
          <UiInput
            v-model="form.notifications.telegramChatId"
            label="Telegram Chat ID"
            placeholder="-100123456789"
          />
        </template>
        <UiText v-else size="small" class="inherit-hint">Используются общие настройки</UiText>
      </div>

    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiInputNumber, UiSwitch, UiText } from '@fastio/ui'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import type { Branch, BranchFormData } from '@fastio/shared'

const props = defineProps<{
  modelValue: boolean
  branch: Branch | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: BranchFormData]
}>()

const formRef = ref()
const saving = ref(false)

const modalActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const defaultForm = (): BranchFormData => ({
  name: '',
  address: null,
  phone: null,
  isActive: true,
  workingHours: null,
  deliveryMinOrder: null,
  deliveryFee: null,
  notifications: null,
})

const form = reactive<BranchFormData>(defaultForm())

const useCustomHours = computed(() => form.workingHours !== null)
const useCustomDelivery = computed(() => form.deliveryMinOrder !== null || form.deliveryFee !== null)
const useCustomNotifications = computed(() => form.notifications !== null)

const toggleCustomHours = (val: boolean) => {
  form.workingHours = val ? '' : null
}

const toggleCustomDelivery = (val: boolean) => {
  form.deliveryMinOrder = val ? 0 : null
  form.deliveryFee = val ? 0 : null
}

const toggleCustomNotifications = (val: boolean) => {
  form.notifications = val ? { email: null, telegramChatId: null } : null
}

watch(
  () => props.modelValue,
  (val) => {
    if (!val) return

    if (props.branch) {
      form.name = props.branch.name
      form.address = props.branch.address
      form.phone = props.branch.phone
      form.isActive = props.branch.isActive
      form.workingHours = props.branch.workingHours ?? null
      form.deliveryMinOrder = props.branch.deliveryMinOrder
      form.deliveryFee = props.branch.deliveryFee
      form.notifications = props.branch.notifications
        ? { ...props.branch.notifications }
        : null
    } else {
      Object.assign(form, defaultForm())
    }
  },
)

const onConfirm = async () => {
  if (!formRef.value?.validate()) return false

  saving.value = true
  try {
    emit('save', { ...form })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.active-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-top: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
}

.override-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid var(--color-border-light);
}

.override-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inherit-hint {
  color: var(--color-text-tertiary);
}

.delivery-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
