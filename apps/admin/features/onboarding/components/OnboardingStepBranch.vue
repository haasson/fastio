<template>
  <div class="step-branch-root">
    <UiTitle size="h3">Первый филиал</UiTitle>
    <UiText size="small" class="hint">
      Филиал — это адресная точка, к которой привязываются записи и сотрудники.
      Если у вас нет физического офиса или вы работаете удалённо — создавать не обязательно,
      но имейте в виду: изменить решение позже можно будет только через поддержку.
    </UiText>

    <UiText v-if="showError && !branchStore.hasBranches && !noPhysicalLocation" size="small" class="error">
      Создайте филиал или отметьте чекбокс <strong>«Не указывать филиал»</strong> ниже.
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

    <template v-else-if="!noPhysicalLocation">
      <UiForm ref="formRef" class="fields">
        <UiInput
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
          :rules="[validationRules.address.required]"
          @pick="onAddressPick"
        />
      </UiForm>

      <UiButton
        type="primary"
        :loading="saving"
        @click="createBranch"
      >
        Создать филиал
      </UiButton>
    </template>

    <UiCheckbox v-if="!branchStore.hasBranches" v-model="noPhysicalLocation">
      Не указывать филиал
    </UiCheckbox>

    <UiAlert v-if="noPhysicalLocation" type="warning" size="small">
      Без филиала клиенты не увидят адрес на витрине, а сотрудников нельзя будет закрепить за конкретной точкой.
      Если решение поменяется — обратитесь в поддержку, чтобы открыть раздел «Филиалы».
    </UiAlert>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiTitle, UiInput, UiText, UiButton, UiCard, UiIcon, UiForm, UiCheckbox, UiAlert, useMessage } from '@fastio/ui'
import { validationRules } from '@fastio/kit'
import type { BranchAddressData } from '@fastio/shared'
import { useBranchStore } from '~/shared/stores/branch'
import AddressSuggestInput from '~/components/ui/AddressSuggestInput.vue'
import type { DadataSuggestion } from '~/composables/delivery/useDadataSuggestions'
import { reportError } from '~/shared/utils/reportError'
import { defaultBranchFormData } from '~/features/branches'

const branchStore = useBranchStore()
const { error } = useMessage()

const showError = ref(false)
const noPhysicalLocation = ref(false)

// Сбрасываем ошибку и опт-аут когда филиал реально создан — не оставляем «висящие» состояния,
// иначе на след. шаге Wizard может ошибочно записать branchNotNeeded=true для тенанта с филиалом.
watch(() => branchStore.hasBranches, (has) => {
  if (has) {
    showError.value = false
    noPhysicalLocation.value = false
  }
})

watch(noPhysicalLocation, () => {
  showError.value = false
})

defineExpose({
  // Возвращаем boolean-значение, не Ref, — чтобы parent не зависел от деталей реактивности.
  isOptedOut: () => noPhysicalLocation.value && !branchStore.hasBranches,
  validate: () => {
    if (branchStore.hasBranches || noPhysicalLocation.value) return true
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

  // Жёсткое требование: адрес выбирается только из подсказок DaData. Без addressData
  // CHECK-constraint в БД упадёт; pickedRule в AddressSuggestInput уже подсветит поле,
  // здесь — финальная страховка чтобы не словить серверную ошибку при сабмите.
  if (!branchAddressData.value) {
    error('Выберите адрес во всплывающей подсказке')

    return
  }

  saving.value = true
  try {
    await branchStore.add({
      ...defaultBranchFormData(),
      name: branchName.value.trim(),
      address: branchAddress.value.trim(),
      addressData: branchAddressData.value,
      latitude: branchLat.value,
      longitude: branchLon.value,
    })
  } catch (e) {
    reportError(e)
    error('Не удалось создать филиал. Попробуйте ещё раз.')
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
