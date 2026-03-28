<template>
  <div class="step-branch-root">
    <UiTitle size="h3">Первый филиал</UiTitle>
    <UiText size="small" class="hint">
      Филиал — это точка, к которой привязываются заказы, зоны доставки и сотрудники.
    </UiText>

    <UiText v-if="showError && !branchStore.hasBranches" size="small" class="error">Создайте хотя бы один филиал</UiText>

    <template v-if="branchStore.hasBranches">
      <UiCard class="done-card">
        <UiIcon name="check" :size="24" class="done-icon" />
        <div>
          <UiText size="medium" class="done-title">{{ branchStore.branches[0]?.name }}</UiText>
          <UiText size="small" class="done-address">{{ branchStore.branches[0]?.address || 'Адрес не указан' }}</UiText>
        </div>
      </UiCard>
    </template>

    <template v-else>
      <UiForm ref="formRef" class="fields">
        <UiInput
          v-model="branchName"
          name="branchName"
          label="Название филиала"
          placeholder="Например: Центральный"
          :rules="[{ type: 'required', message: 'Укажите название филиала' }]"
        />

        <AddressSuggestInput v-model="branchAddress" @pick="onAddressPick" />
      </UiForm>

      <UiButton
        type="primary"
        :loading="saving"
        @click="createBranch"
      >
        Создать филиал
      </UiButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiTitle, UiInput, UiText, UiButton, UiCard, UiIcon, UiForm } from '@fastio/ui'
import { useBranchStore } from '~/stores/branch'
import AddressSuggestInput from '~/components/ui/AddressSuggestInput.vue'
import type { DadataSuggestion } from '~/composables/delivery/useDadataSuggestions'

const branchStore = useBranchStore()

const showError = ref(false)

defineExpose({
  validate: () => {
    if (!branchStore.hasBranches) {
      showError.value = true

      return false
    }

    return true
  },
})

const formRef = ref<InstanceType<typeof UiForm> | null>(null)
const branchName = ref('')
const branchAddress = ref<string | null>('')
const branchLat = ref<number | null>(null)
const branchLon = ref<number | null>(null)
const saving = ref(false)

const onAddressPick = (s: DadataSuggestion) => {
  if (s.data.geo_lat && s.data.geo_lon) {
    branchLat.value = parseFloat(s.data.geo_lat)
    branchLon.value = parseFloat(s.data.geo_lon)
  }
}

const createBranch = async () => {
  const valid = formRef.value?.validate()

  if (!valid) return

  saving.value = true
  try {
    await branchStore.add({
      name: branchName.value.trim(),
      address: branchAddress.value?.trim() || null,
      phone: null,
      isActive: true,
      workingHours: null,
      deliveryMinOrder: null,
      deliveryFee: null,
      notifications: null,
      color: '#6366f1',
      latitude: branchLat.value,
      longitude: branchLon.value,
      orderNumberPrefix: null,
    })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.step-branch-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hint {
  color: var(--color-text-secondary);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.done-card {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.done-icon {
  color: var(--color-success);
  flex-shrink: 0;
}

.done-title {
  font-weight: 600;
}

.done-address {
  color: var(--color-text-secondary);
}

.error {
  color: var(--color-error);
}
</style>
