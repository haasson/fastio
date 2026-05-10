<template>
  <UiCard size="large">
    <UiForm @submit.prevent="page.submit">
      <div class="form">
        <div class="row">
          <div class="field" data-tour="kitchen-setting-source-status">
            <UiSelect
              :value="form.sourceStatusId ?? ''"
              :options="statusOptions"
              label="Статус для отправки на кухню"
              message="Когда заказ переходит в этот статус, блюда появляются в очереди"
              placeholder="Выберите статус"
              @update:value="form.sourceStatusId = String($event) || null"
            />
          </div>

          <div class="field" data-tour="kitchen-setting-cooking-status">
            <UiSelect
              :value="form.cookingStatusId ?? ''"
              :options="statusOptions"
              label="Статус при начале готовки или сборки"
              message="Когда повар берёт первое блюдо или сборщик собирает позицию"
              placeholder="Не менять"
              clearable
              @update:value="form.cookingStatusId = ($event as string) ?? null"
            />
          </div>
        </div>

        <div class="row" data-tour="kitchen-setting-completed-map">
          <div v-if="deliveryActive" class="field">
            <UiSelect
              :value="form.completedStatusMap.delivery ?? ''"
              :options="statusOptions"
              label="Собрано: доставка"
              message="Когда сборщик нажмёт «Собрано», заказ перейдёт в этот статус"
              placeholder="Не менять"
              clearable
              @update:value="form.completedStatusMap.delivery = ($event as string) ?? null"
            />
          </div>

          <div v-if="pickupActive" class="field">
            <UiSelect
              :value="form.completedStatusMap.pickup ?? ''"
              :options="statusOptions"
              label="Собрано: самовывоз"
              message="Когда сборщик нажмёт «Собрано», заказ перейдёт в этот статус"
              placeholder="Не менять"
              clearable
              @update:value="form.completedStatusMap.pickup = ($event as string) ?? null"
            />
          </div>
        </div>

        <UiInputNumber
          v-model="form.urgencyMinutes"
          label="Порог срочности (минуты)"
          message="Карточки блюд начнут подсвечиваться жёлтым на&nbsp;66% и&nbsp;красным на&nbsp;100% этого времени"
          :min="1"
          :max="120"
          :show-button="true"
          data-tour="kitchen-setting-urgency"
        />
      </div>
    </UiForm>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiCard, UiForm, UiSelect, UiInputNumber } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'
import { useOrderStatusesStore } from '~/features/orders'
import { useGate } from '~/composables/plan/useGate'
import { useEditableForm } from '~/composables/ui/useEditableForm'
import { useRegisterPageForm } from '~/composables/ui/usePageForm'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'

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
@use '@fastio/styles/mixins/form' as *;

.form {
  @include modal-form;
}

.row {
  display: flex;
  gap: var(--space-16);
  flex-wrap: wrap;

  .field {
    flex: 1;
    min-width: 200px;
  }
}
</style>
