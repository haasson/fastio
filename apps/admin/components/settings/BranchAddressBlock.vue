<template>
  <UiCard size="large" class="block">
    <UiSectionHeader title="Адрес и координаты" />

    <UiForm class="form" @submit.prevent="page.submit">
      <AddressWithMap
        v-model:address="form.address"
        v-model:latitude="form.latitude"
        v-model:longitude="form.longitude"
      />
    </UiForm>
  </UiCard>
</template>

<script setup lang="ts">
// Блок не self-contained: своих кнопок и unsaved-guard'а у него нет. Родитель должен
// забрать `handle` через template ref и зарегистрировать в pageForm — иначе save-bar
// не появится. Сейчас единственный потребитель — pages/branches.vue.
import { toRef } from 'vue'
import { UiCard, UiForm, UiSectionHeader } from '@fastio/ui'
import type { Branch } from '@fastio/shared'
import { useBranchStore } from '~/stores/branch'
import AddressWithMap from '~/components/ui/AddressWithMap.vue'
import { useEditableForm } from '~/composables/ui/useEditableForm'

const props = defineProps<{ branch: Branch }>()

const branchStore = useBranchStore()

const page = useEditableForm({
  source: toRef(props, 'branch'),
  build: (b: Branch) => ({
    address: b.address,
    latitude: b.latitude,
    longitude: b.longitude,
  }),
  save: (data) => branchStore.update(props.branch.id, {
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
  }),
})

const { form } = page

defineExpose({ handle: page })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.block {
  gap: var(--space-16);
}

.form {
  @include flex-col(var(--space-16));
}
</style>
