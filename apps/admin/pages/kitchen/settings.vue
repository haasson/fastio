<template>
  <UiCard size="large">
    <UiForm @submit="handleSave">
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

        <div class="footer">
          <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
        </div>
      </div>
    </UiForm>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { UiCard, UiForm, UiSelect, UiInputNumber, UiButton, useMessage } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useModules } from '~/composables/plan/useModules'

const tenantStore = useTenantStore()
const { statuses } = storeToRefs(useOrderStatusesStore())
const modules = useModules()
const { success } = useMessage()

const tenant = computed(() => tenantStore.tenant)

const deliveryActive = computed(() => modules.delivery?.value.active)
const pickupActive = computed(() => modules.pickup?.value.active)

const statusOptions = computed(() => statuses.value.map((s) => ({ label: s.name, value: s.id })))

const form = reactive({
  sourceStatusId: tenant.value.kitchenConfig?.sourceStatusId ?? null as string | null,
  cookingStatusId: tenant.value.kitchenConfig?.cookingStatusId ?? null as string | null,
  completedStatusMap: {
    delivery: tenant.value.kitchenConfig?.completedStatusMap?.delivery ?? null as string | null,
    pickup: tenant.value.kitchenConfig?.completedStatusMap?.pickup ?? null as string | null,
    dine_in: tenant.value.kitchenConfig?.completedStatusMap?.dine_in ?? null as string | null,
  },
  urgencyMinutes: tenant.value.kitchenUrgencyMinutes ?? 15,
})

watch(tenant, (t) => {
  form.sourceStatusId = t.kitchenConfig?.sourceStatusId ?? null
  form.cookingStatusId = t.kitchenConfig?.cookingStatusId ?? null
  form.completedStatusMap.delivery = t.kitchenConfig?.completedStatusMap?.delivery ?? null
  form.completedStatusMap.pickup = t.kitchenConfig?.completedStatusMap?.pickup ?? null
  form.completedStatusMap.dine_in = t.kitchenConfig?.completedStatusMap?.dine_in ?? null
  form.urgencyMinutes = t.kitchenUrgencyMinutes ?? 15
})

const saving = ref(false)

const handleSave = async () => {
  saving.value = true
  try {
    await tenantStore.update({
      kitchenConfig: {
        sourceStatusId: form.sourceStatusId,
        cookingStatusId: form.cookingStatusId,
        completedStatusMap: form.completedStatusMap,
      },
      kitchenUrgencyMinutes: form.urgencyMinutes,
    })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
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

.footer {
  padding-top: var(--space-8);
}
</style>
