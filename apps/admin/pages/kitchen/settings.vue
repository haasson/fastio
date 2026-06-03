<template>
  <UiForm class="form" @submit.prevent="page.submit">
    <UiFormSection title="Статусы кухни" :columns="2">
      <UiSelect
        :value="form.sourceStatusId ?? ''"
        data-tour="kitchen-setting-source-status"
        :options="statusOptions"
        label="Статус для отправки на кухню"
        help="Когда заказ переходит в этот статус, блюда появляются в очереди"
        placeholder="Выберите статус"
        @update:value="form.sourceStatusId = String($event) || null"
      />

      <UiSelect
        :value="form.cookingStatusId ?? ''"
        data-tour="kitchen-setting-cooking-status"
        :options="statusOptions"
        label="Статус при начале готовки или сборки"
        help="Когда повар берёт первое блюдо или сборщик собирает позицию"
        placeholder="Не менять"
        clearable
        @update:value="form.cookingStatusId = ($event as string) ?? null"
      />
    </UiFormSection>

    <UiFormSection
      v-if="deliveryActive || pickupActive"
      title="Статус после сборки"
      data-tour="kitchen-setting-completed-map"
      :columns="2"
    >
      <UiSelect
        v-if="deliveryActive"
        :value="form.completedStatusMap.delivery ?? ''"
        :options="statusOptions"
        label="Собрано: доставка"
        help="Когда сборщик нажмёт «Собрано», заказ перейдёт в этот статус"
        placeholder="Не менять"
        clearable
        @update:value="form.completedStatusMap.delivery = ($event as string) ?? null"
      />

      <UiSelect
        v-if="pickupActive"
        :value="form.completedStatusMap.pickup ?? ''"
        :options="statusOptions"
        label="Собрано: самовывоз"
        help="Когда сборщик нажмёт «Собрано», заказ перейдёт в этот статус"
        placeholder="Не менять"
        clearable
        @update:value="form.completedStatusMap.pickup = ($event as string) ?? null"
      />
    </UiFormSection>

    <UiFormSection title="Срочность">
      <UiInputNumber
        v-model="form.urgencyMinutes"
        data-tour="kitchen-setting-urgency"
        label="Порог срочности (минуты)"
        help="Карточки блюд начнут подсвечиваться жёлтым на 66% и красным на 100% этого времени"
        :min="1"
        :max="120"
        :show-button="true"
      />
    </UiFormSection>
  </UiForm>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiForm, UiFormSection, UiSelect, UiInputNumber } from '@fastio/ui'
import { useTenantStore } from '~/shared/stores/tenant'
import { useOrderStatusesStore } from '~/features/orders'
import { useGate } from '~/shared/plan/useGate'
import { useEditableForm } from '~/shared/ui/composables/useEditableForm'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'

const tenantStore = useTenantStore()
const { statuses } = storeToRefs(useOrderStatusesStore())
const gate = useGate()

const tenant = computed(() => tenantStore.tenant)

const deliveryActive = computed(() => gate.delivery.value.enabled)
const pickupActive = computed(() => gate.pickup.value.enabled)

const statusOptions = computed(() => statuses.value.map((s) => ({ label: s.name, value: s.id })))

const page = useEditableForm({
  source: tenant,
  build: (t) => ({
    sourceStatusId: t.kitchenConfig?.sourceStatusId ?? null as string | null,
    cookingStatusId: t.kitchenConfig?.cookingStatusId ?? null as string | null,
    completedStatusMap: {
      delivery: t.kitchenConfig?.completedStatusMap?.delivery ?? null as string | null,
      pickup: t.kitchenConfig?.completedStatusMap?.pickup ?? null as string | null,
      dine_in: t.kitchenConfig?.completedStatusMap?.dine_in ?? null as string | null,
    },
    urgencyMinutes: t.kitchenUrgencyMinutes ?? 15,
  }),
  save: (data) => tenantStore.update({
    kitchenConfig: {
      sourceStatusId: data.sourceStatusId,
      cookingStatusId: data.cookingStatusId,
      completedStatusMap: data.completedStatusMap,
    },
    kitchenUrgencyMinutes: data.urgencyMinutes,
  }),
})

const { form } = page

useRegisterPageForm(page)
useUnsavedGuard(page.isDirty)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.form {
  @include flex-col(var(--space-12));
  max-width: 720px;
}
</style>
