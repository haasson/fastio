<template>
  <UiCard size="large" class="block">
    <UiSectionHeader title="Адрес и координаты" />

    <UiForm ref="formRef" class="form" @submit.prevent="page.submit">
      <AddressWithMap
        v-model:address="form.address"
        v-model:address-data="form.addressData"
        v-model:latitude="form.latitude"
        v-model:longitude="form.longitude"
        name="address"
        :rules="[validationRules.address.required]"
      />
    </UiForm>
  </UiCard>
</template>

<script setup lang="ts">
// Блок не self-contained: своих кнопок и unsaved-guard'а у него нет. Родитель должен
// забрать `handle` через template ref и зарегистрировать в pageForm — иначе save-bar
// не появится. Сейчас единственный потребитель — pages/branches.vue.
import { ref, toRef } from 'vue'
import { UiCard, UiForm, UiSectionHeader } from '@fastio/ui'
import type { Branch, BranchAddressData } from '@fastio/shared'
import { validationRules } from '@fastio/kit'
import { useBranchStore } from '~/stores/branch'
import AddressWithMap from '~/components/ui/AddressWithMap.vue'
import { useEditableForm, cancelSubmit } from '~/composables/ui/useEditableForm'

const props = defineProps<{ branch: Branch }>()

const branchStore = useBranchStore()
const formRef = ref()

const page = useEditableForm({
  source: toRef(props, 'branch'),
  build: (b: Branch) => ({
    address: b.address,
    addressData: b.addressData as BranchAddressData | null,
    latitude: b.latitude,
    longitude: b.longitude,
  }),
  save: async (data) => {
    // save-bar зовёт submit() мимо UiForm.@submit, поэтому валидируем тут вручную.
    // pickedRule в AddressSuggestInput пометит поле красным, а cancelSubmit тихо
    // прервёт save без error-тоста (текст под полем уже всё объясняет).
    if (formRef.value && !formRef.value.validate()) throw cancelSubmit()

    await branchStore.update(props.branch.id, {
      address: data.address,
      addressData: data.addressData ?? undefined,
      latitude: data.latitude,
      longitude: data.longitude,
    })
  },
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
