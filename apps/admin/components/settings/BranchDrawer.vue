<template>
  <UiDrawer
    :model-value="modelValue"
    :title="branch ? branch.name : 'Новый филиал'"
    :width="520"
    :actions="drawerActions"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="branch-form">
      <UiInput
        v-model="form.name"
        name="name"
        label="Название *"
        placeholder="Центральный"
        :rules="[validationRules.name.required]"
      />

      <UiColorPicker v-model="form.color" label="Цвет филиала" :presets="BRANCH_COLORS" />

      <AddressSuggestInput
        v-model="form.address"
        placeholder="ул. Ленина, 1"
        @pick="onAddressPick"
      />

      <!-- Координаты на миникарте -->
      <div class="coords-block">
        <UiText size="small" class="coords-label">Координаты на карте</UiText>
        <div class="coords-map">
          <YandexMap
            :settings="miniMapSettings"
            width="100%"
            height="100%"
          >
            <YandexMapDefaultSchemeLayer />
            <YandexMapDefaultFeaturesLayer />
            <YandexMapMarker
              v-if="form.latitude != null && form.longitude != null"
              :settings="{ coordinates: [form.longitude!, form.latitude!] }"
            >
              <div class="coords-pin" />
            </YandexMapMarker>
            <YandexMapListener :settings="miniMapListenerSettings" />
          </YandexMap>
        </div>
        <UiText v-if="form.latitude != null" size="tiny" class="coords-hint">
          {{ form.latitude.toFixed(6) }}, {{ form.longitude?.toFixed(6) }}
        </UiText>
        <UiText v-else size="tiny" class="coords-hint">Кликните на карту, чтобы поставить точку</UiText>
      </div>
      <template v-if="hasMultipleBranches">
        <UiInput
          v-model="form.phone"
          label="Телефон"
          placeholder="+7 (900) 000-00-00"
          :rules="[validationRules.phone.format]"
        />

        <UiInput
          v-model="form.orderNumberPrefix"
          label="Префикс номера заказа"
          placeholder="MSK"
          :disabled="prefixLocked"
          :hint="prefixLocked ? 'Включите нумерацию «По филиалам» в настройках' : undefined"
        />

        <div class="active-row">
          <UiText size="small">Филиал активен</UiText>
          <UiSwitch v-model="form.isActive" />
        </div>

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
      </template>
    </UiForm>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  UiDrawer,
  UiForm, UiInput, UiSwitch, UiText, UiSectionHeader,
} from '@fastio/ui'
import {
  YandexMap,
  YandexMapDefaultSchemeLayer,
  YandexMapDefaultFeaturesLayer,
  YandexMapMarker,
  YandexMapListener,
} from 'vue-yandex-maps'
import type { YandexMapListenerSettings } from 'vue-yandex-maps'

import type { Branch, BranchFormData } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import type { DadataSuggestion } from '~/composables/delivery/useDadataSuggestions'
import { validationRules } from '@fastio/kit'
import UiColorPicker from '~/components/ui/ColorPicker.vue'
import AddressSuggestInput from '~/components/ui/AddressSuggestInput.vue'

const BRANCH_COLORS = ['#FF5500', '#FFA500', '#00C853', '#2979FF', '#AA00FF', '#E91E63', '#795548']

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const prefixLocked = computed(() => tenantStore.tenant?.orderNumberConfig?.scope !== 'per_branch')
const hasMultipleBranches = computed(() => branchStore.branches.length > 1)

const onAddressPick = (s: DadataSuggestion) => {
  if (s.data.geo_lat && s.data.geo_lon) {
    form.latitude = parseFloat(s.data.geo_lat)
    form.longitude = parseFloat(s.data.geo_lon)
  }
}

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

const drawerActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const MOSCOW: [number, number] = [37.617617, 55.755864]

const miniMapSettings = computed(() => {
  const center = form.latitude != null && form.longitude != null
    ? [form.longitude!, form.latitude!] as [number, number]
    : MOSCOW

  return { location: { center, zoom: 14 } }
})

const miniMapListenerSettings = computed((): YandexMapListenerSettings => ({
  onClick: (_obj, event) => {
    const [lng, lat] = event.coordinates

    form.latitude = lat
    form.longitude = lng
  },
}))

const defaultForm = (): BranchFormData => ({
  name: '',
  color: BRANCH_COLORS[0],
  address: null,
  phone: null,
  isActive: true,
  workingHours: null,
  deliveryMinOrder: null,
  deliveryFee: null,
  notifications: null,
  latitude: null,
  longitude: null,
  orderNumberPrefix: null,
})

const form = reactive<BranchFormData>(defaultForm())

const useCustomHours = computed(() => form.workingHours !== null)
const useCustomNotifications = computed(() => form.notifications !== null)

const toggleCustomHours = (val: boolean) => {
  form.workingHours = val ? '' : null
}
const toggleCustomNotifications = (val: boolean) => {
  form.notifications = val ? { email: null, telegramChatId: null } : null
}

watch(() => props.modelValue, (val) => {
  if (!val) return

  if (props.branch) {
    form.name = props.branch.name
    form.color = props.branch.color
    form.address = props.branch.address
    form.phone = props.branch.phone
    form.isActive = props.branch.isActive
    form.workingHours = props.branch.workingHours ?? null
    form.deliveryMinOrder = props.branch.deliveryMinOrder
    form.deliveryFee = props.branch.deliveryFee
    form.notifications = props.branch.notifications ? { ...props.branch.notifications } : null
    form.latitude = props.branch.latitude
    form.longitude = props.branch.longitude
    form.orderNumberPrefix = props.branch.orderNumberPrefix ?? null
  } else {
    Object.assign(form, defaultForm())
  }
})

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
.branch-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 12px;
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

.coords-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.coords-label {
  font-weight: 500;
}

.coords-map {
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

.coords-pin {
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, -50%);
}

.coords-hint {
  color: var(--color-text-hint);
}
</style>
