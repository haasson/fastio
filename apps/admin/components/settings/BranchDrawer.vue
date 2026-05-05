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

      <UiColorPicker v-model="form.color" label="Цвет филиала" :presets="BRANCH_COLOR_PRESETS" />

      <AddressWithMap
        v-model:address="form.address"
        v-model:address-data="form.addressData"
        v-model:latitude="form.latitude"
        v-model:longitude="form.longitude"
        name="address"
        map-label="Координаты на карте"
        :map-height="200"
        :rules="[validationRules.address.required]"
      />
      <template v-if="hasMultipleBranches">
        <UiInput
          v-model="form.phone"
          label="Телефон"
          placeholder="+7 (900) 000-00-00"
          :rules="[validationRules.phone.format]"
        />

        <div class="override-block">
          <UiSectionHeader title="Часы работы">
            <template #right>
              <div class="override-toggle">
                <UiText size="tiny">Своё расписание</UiText>
                <UiSwitch :model-value="useCustomHours" @update:model-value="toggleCustomHours" />
              </div>
            </template>
          </UiSectionHeader>
          <WorkingHoursEditor
            v-if="useCustomHours && form.workingHoursSchedule"
            v-model="form.workingHoursSchedule"
          />
          <UiText v-else size="small" class="inherit-hint">Используются общие настройки</UiText>
        </div>

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
import WorkingHoursEditor from '~/components/settings/WorkingHoursEditor.vue'

import type { Branch, BranchFormData } from '@fastio/shared'
import { BRANCH_COLOR_PRESETS, DEFAULT_WORKING_HOURS_SCHEDULE } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { validationRules } from '@fastio/kit'
import UiColorPicker from '~/components/ui/ColorPicker.vue'
import AddressWithMap from '~/components/ui/AddressWithMap.vue'
import { defaultBranchFormData } from '~/utils/branch'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const prefixLocked = computed(() => tenantStore.tenant.orderNumberConfig?.scope !== 'per_branch')
const hasMultipleBranches = computed(() => branchStore.branches.length > 1)

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

const defaultForm = (): BranchFormData => defaultBranchFormData()

const form = reactive<BranchFormData>(defaultForm())

const useCustomHours = computed(() => form.workingHoursSchedule !== null)

const toggleCustomHours = (val: boolean) => {
  form.workingHoursSchedule = val ? { ...DEFAULT_WORKING_HOURS_SCHEDULE } : null
}

watch(() => props.modelValue, (val) => {
  if (!val) return

  if (props.branch) {
    form.name = props.branch.name
    form.color = props.branch.color
    form.address = props.branch.address
    form.addressData = props.branch.addressData
    form.phone = props.branch.phone
    form.isActive = props.branch.isActive
    form.workingHoursSchedule = props.branch.workingHoursSchedule ?? null
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
  gap: var(--space-12);
  padding: var(--space-4) 0 var(--space-12);
}

.active-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-8) 0;
  border-top: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
}

.override-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-12) 0;
  border-top: 1px solid var(--color-border-light);
}

.override-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.inherit-hint {
  color: var(--color-text-secondary);
}
</style>
