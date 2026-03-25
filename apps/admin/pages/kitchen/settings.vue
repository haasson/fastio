<template>
  <UiCard size="large">
    <UiForm @submit="handleSave">
      <div class="form">
        <div class="field">
          <UiSelect
            :value="form.sourceStatusId ?? ''"
            :options="statusOptions"
            label="Статус для отправки на кухню"
            placeholder="Выберите статус"
            @update:value="form.sourceStatusId = String($event) || null"
          />
          <span class="hint">Для доставки и самовывоза: когда заказ переходит в этот статус, блюда появляются в очереди. Заказы со стола попадают на кухню автоматически</span>
        </div>

        <div class="row">
          <div v-if="deliveryActive" class="field">
            <UiSelect
              :value="form.completedStatusMap.delivery ?? ''"
              :options="statusOptions"
              label="Доставка"
              placeholder="Не менять"
              @update:value="form.completedStatusMap.delivery = String($event) || null"
            />
          </div>

          <div v-if="pickupActive" class="field">
            <UiSelect
              :value="form.completedStatusMap.pickup ?? ''"
              :options="statusOptions"
              label="Самовывоз"
              placeholder="Не менять"
              @update:value="form.completedStatusMap.pickup = String($event) || null"
            />
          </div>

        </div>

        <span class="hint">Когда все блюда заказа готовы, заказ автоматически перейдёт в выбранный статус</span>

        <div class="field">
          <UiInputNumber
            v-model="form.urgencyMinutes"
            label="Порог срочности (минуты)"
            :min="1"
            :max="120"
          />
          <span class="hint">Карточки блюд начнут подсвечиваться жёлтым на 66% и красным на 100% этого времени</span>
        </div>

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
  sourceStatusId: tenant.value?.kitchenConfig?.sourceStatusId ?? null as string | null,
  completedStatusMap: {
    delivery: tenant.value?.kitchenConfig?.completedStatusMap?.delivery ?? null as string | null,
    pickup: tenant.value?.kitchenConfig?.completedStatusMap?.pickup ?? null as string | null,
    dine_in: tenant.value?.kitchenConfig?.completedStatusMap?.dine_in ?? null as string | null,
  },
  urgencyMinutes: tenant.value?.kitchenUrgencyMinutes ?? 15,
})

watch(tenant, (t) => {
  if (!t) return
  form.sourceStatusId = t.kitchenConfig?.sourceStatusId ?? null
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
.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;

  .field {
    flex: 1;
    min-width: 200px;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.footer {
  padding-top: 8px;
}
</style>
