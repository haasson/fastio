<template>
  <UiCard size="large" class="block">
    <UiSectionHeader title="Адрес и координаты" />

    <UiForm class="form" @submit="handleSave">
      <AddressWithMap
        v-model:address="form.address"
        v-model:latitude="form.latitude"
        v-model:longitude="form.longitude"
      />

      <div class="actions">
        <UiButton
          submit
          type="primary"
          :loading="saving"
          :disabled="!isDirty"
        >
          Сохранить
        </UiButton>
      </div>
    </UiForm>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiCard, UiForm, UiButton, useMessage, UiSectionHeader } from '@fastio/ui'
import type { Branch } from '@fastio/shared'
import { useBranchStore } from '~/stores/branch'
import AddressWithMap from '~/components/ui/AddressWithMap.vue'
import { useFormDirty } from '~/composables/ui/useFormDirty'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'

const props = defineProps<{ branch: Branch }>()

const branchStore = useBranchStore()

const buildForm = (b: Branch) => ({
  address: b.address,
  latitude: b.latitude,
  longitude: b.longitude,
})

const form = reactive(buildForm(props.branch))
const { isDirty, reset } = useFormDirty(form)

watch(() => props.branch, (b) => {
  Object.assign(form, buildForm(b))
  reset()
})

const saving = ref(false)
const { success } = useMessage()

useUnsavedGuard(isDirty)

const handleSave = async () => {
  saving.value = true
  try {
    await branchStore.update(props.branch.id, {
      address: form.address,
      latitude: form.latitude,
      longitude: form.longitude,
    })
    reset()
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.block {
  gap: var(--space-16);
}

.form {
  @include flex-col(var(--space-16));
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
