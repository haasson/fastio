<template>
  <div class="step-branch-root">
    <UiTitle size="h3">{{ cityOnlyMode ? 'Город заведения' : 'Первый филиал' }}</UiTitle>
    <UiText size="small" class="hint">
      <template v-if="cityOnlyMode">
        Укажите город — клиенты увидят его на витрине. Полный адрес можно добавить позже в разделе «Заведение».
      </template>
      <template v-else>
        Филиал — это адресная точка, к которой привязываются записи и сотрудники. Без него не получится принимать заказы и бронирования.
      </template>
    </UiText>

    <UiText v-if="showError && !branchStore.hasBranches" size="small" class="error">
      {{ cityOnlyMode ? 'Выберите город из подсказок.' : 'Заполните название и адрес филиала.' }}
    </UiText>

    <template v-if="branchStore.hasBranches">
      <UiCard class="done-card">
        <UiIcon name="check" :size="24" class="done-icon" />
        <div>
          <UiText size="medium" class="done-title">{{ branchStore.branches[0]?.name }}</UiText>
          <UiText size="small" class="done-address">{{ branchStore.branches[0]?.address }}</UiText>
        </div>
      </UiCard>
    </template>

    <template v-else>
      <UiForm ref="formRef" class="fields">
        <UiInput
          v-if="!cityOnlyMode"
          v-model="branchName"
          name="branchName"
          label="Название филиала"
          placeholder="Например: Центральный"
          :rules="branchNameRules"
        />

        <AddressSuggestInput
          v-model="branchAddress"
          v-model:address-data="branchAddressData"
          name="branchAddress"
          :label="cityOnlyMode ? 'Город *' : 'Адрес *'"
          :placeholder="cityOnlyMode ? 'Начните вводить город...' : 'Начните вводить адрес...'"
          :city-only="cityOnlyMode"
          :rules="[validationRules.address.required]"
          @pick="onAddressPick"
        />
      </UiForm>

      <UiButton
        type="primary"
        :loading="saving"
        @click="createBranch"
      >
        {{ cityOnlyMode ? 'Сохранить' : 'Создать филиал' }}
      </UiButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiTitle, UiInput, UiText, UiButton, UiCard, UiIcon, UiForm, useMessage } from '@fastio/ui'
import { validationRules } from '@fastio/kit'
import type { BranchAddressData } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import AddressSuggestInput from '~/shared/ui/components/AddressSuggestInput.vue'
import type { DadataSuggestion } from '~/shared/composables/delivery/useDadataSuggestions'
import { reportError } from '~/shared/utils/reportError'
import { defaultBranchFormData } from '~/features/branches'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const { error } = useMessage()

const showError = ref(false)

// Showcase-планы (бесплатные «Витрина») — упрощённый ввод: только город,
// название филиала автогенерится из названия тенанта. Остальные планы (Старт/Про,
// retail и services) требуют полный адрес.
const cityOnlyMode = computed(() => {
  const plan = tenantStore.maybeTenant?.subscription?.plan ?? ''

  return plan === 'retail-showcase' || plan === 'services-showcase'
})

defineExpose({
  validate: () => {
    if (branchStore.hasBranches) return true
    showError.value = true

    return false
  },
})

const formRef = ref<InstanceType<typeof UiForm> | null>(null)
const branchName = ref('')
const branchAddress = ref<string>('')
const branchAddressData = ref<BranchAddressData | null>(null)
const branchLat = ref<number | null>(null)
const branchLon = ref<number | null>(null)
const saving = ref(false)

// Валидация на пустоту с учётом trim — без этого «   » проходит required.
const branchNameRules = [
  { required: true, message: 'Введите название филиала' },
  {
    validator: (value: string) => Boolean(value?.trim()),
    message: 'Введите название филиала',
    trigger: 'blur',
  },
]

const onAddressPick = (s: DadataSuggestion) => {
  // Сначала очищаем — иначе при выборе адреса без координат останутся старые.
  branchLat.value = null
  branchLon.value = null

  if (s.data.geo_lat && s.data.geo_lon) {
    branchLat.value = parseFloat(s.data.geo_lat)
    branchLon.value = parseFloat(s.data.geo_lon)
  }
}

const createBranch = async () => {
  const valid = formRef.value?.validate()

  if (!valid) return

  // Жёсткое требование: адрес/город выбирается только из подсказок DaData. Без
  // addressData CHECK-constraint в БД упадёт; pickedRule в AddressSuggestInput
  // уже подсветит поле, здесь — финальная страховка.
  if (!branchAddressData.value) {
    error(cityOnlyMode.value ? 'Выберите город во всплывающей подсказке' : 'Выберите адрес во всплывающей подсказке')

    return
  }

  saving.value = true
  try {
    // В showcase-режиме название берём из имени тенанта — юзеру не приходится
    // выдумывать второе название (его «Главный»/«Центральный» одинаково для
    // 95% случаев).
    const effectiveName = cityOnlyMode.value
      ? (tenantStore.maybeTenant?.name?.trim() || 'Основной')
      : branchName.value.trim()

    await branchStore.add({
      ...defaultBranchFormData(),
      name: effectiveName,
      address: branchAddress.value.trim(),
      addressData: branchAddressData.value,
      latitude: branchLat.value,
      longitude: branchLon.value,
    })
  } catch (e) {
    reportError(e)
    error('Не удалось сохранить. Попробуйте ещё раз.')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.step-branch-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.hint {
  color: var(--color-text-secondary);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.done-card {
  flex-direction: row;
  align-items: center;
  gap: var(--space-12);
}

.done-icon {
  color: var(--color-success);
  flex-shrink: 0;
}

.done-title {
  font-weight: var(--font-weight-semibold);
}

.done-address {
  color: var(--color-text-secondary);
}

.error {
  color: var(--color-error);
}
</style>
