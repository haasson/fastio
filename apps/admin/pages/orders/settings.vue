<template>
  <div class="settings-root">
    <UiForm class="form" @submit="handleSave">
      <UiSectionHeader title="Предзаказ" />

      <div data-tour="preorder-toggle">
        <SettingToggle
          v-model="form.enabled"
          label="Разрешить заказ ко времени"
          hint="Клиент сможет выбрать — «как можно скорее» или к конкретному времени. Если выключено, заказ всегда оформляется как можно скорее."
        />
      </div>

      <template v-if="form.enabled">
        <UiSectionHeader title="Статусы" />
        <div class="row row-half">
          <UiSelect
            v-model:value="form.nextStatusId"
            label="Статус после срабатывания"
            :options="statusOptions"
            clearable
            placeholder="Не выбран"
          />
        </div>
        <p class="section-hint">
          <strong>Статус после срабатывания</strong> — в этот статус система автоматически переведёт заказ, когда настанет время начала готовки.
          Обычно это первый рабочий статус, например «Принят» или «На кухне».
          <br /><br />
          Система автоматически создаёт статус <strong>«Запланировано»</strong> (в группе «Новые»), куда оператор переводит входящие заказы ко времени. Когда время наступит, заказ сам перейдёт в выбранный статус выше.
        </p>

        <UiSectionHeader title="Доступные даты" />
        <div data-tour="preorder-slots" class="row row-half">
          <UiInputNumber
            v-model:value="form.daysAhead"
            label="Дней вперёд"
            :min="1"
            :max="30"
            :show-button="true"
          />
          <UiSelect
            v-model:value="form.slotStep"
            label="Шаг слотов"
            :options="SLOT_STEP_OPTIONS"
          />
        </div>

        <UiSectionHeader title="Буферы" />
        <div data-tour="preorder-buffers" class="row row-three">
          <UiSelect
            v-model:value="form.closeBufferMinutes"
            label="Буфер при закрытии"
            :options="bufferOptions"
          />
          <UiSelect
            v-if="gate.delivery.value.enabled"
            v-model:value="form.deliveryLeadMinutes"
            label="Буфер при открытии — доставка"
            :options="leadOptions"
          />
          <UiSelect
            v-if="gate.pickup.value.enabled"
            v-model:value="form.pickupLeadMinutes"
            label="Буфер при открытии — самовывоз"
            :options="leadOptions"
          />
        </div>
        <p class="section-hint">
          <strong>Буфер при закрытии</strong> — за сколько минут до конца дня исчезает опция «как можно скорее» и обрезаются последние слоты.
          Например, заведение работает до&nbsp;22:00, буфер 30&nbsp;мин — с&nbsp;21:30 опция «сейчас» недоступна и&nbsp;последний доступный слот тоже 21:30.
          <br /><br />
          <strong>Буфер при открытии</strong> — минимальный интервал от текущего момента до ближайшего доступного слота.
          Например, буфер 60 мин — клиент не увидит слоты раньше чем через час от текущего времени.
        </p>
      </template>

      <div class="footer">
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { UiForm, UiInputNumber, UiButton, UiSectionHeader, UiSelect, useMessage } from '@fastio/ui'
import type { OrderSchedulingConfig } from '@fastio/shared'
import { buildMinuteOptions } from '@fastio/shared'
import { storeToRefs } from 'pinia'
import { useTenantStore } from '~/stores/tenant'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useGate } from '~/composables/plan/useGate'
import { useDatabase } from '~/composables/data/useDatabase'
import SettingToggle from '~/components/ui/SettingToggle.vue'

const SLOT_STEP_OPTIONS = [
  { label: '15 мин', value: 15 },
  { label: '30 мин', value: 30 },
  { label: '1 час', value: 60 },
]

const tenantStore = useTenantStore()
const { statuses } = storeToRefs(useOrderStatusesStore())
const api = useDatabase()
const gate = useGate()
const { success, error } = useMessage()
const saving = ref(false)

const tenant = computed(() => tenantStore.tenant)

const statusOptions = computed(() => statuses.value
  .filter((s) => s.groupType === 'in_progress')
  .map((s) => ({ label: s.name, value: s.id })),
)

const defaultConfig = (): OrderSchedulingConfig => ({
  enabled: false,
  slotStep: 30,
  daysAhead: 3,
  deliveryLeadMinutes: 60,
  pickupLeadMinutes: 30,
  closeBufferMinutes: 30,
  holdingStatusId: null,
  nextStatusId: null,
})

const buildForm = (cfg?: OrderSchedulingConfig | null): OrderSchedulingConfig => ({
  ...defaultConfig(),
  ...cfg,
})

const form = reactive<OrderSchedulingConfig>(buildForm(tenant.value.orderSchedulingConfig))

const leadOptions = computed(() => buildMinuteOptions(form.slotStep, 120))
const bufferOptions = computed(() => buildMinuteOptions(form.slotStep, 120, true))

watch(tenant, (t) => Object.assign(form, buildForm(t.orderSchedulingConfig)))

// При смене шага — округляем буферы вверх до ближайшего кратного
watch(() => form.slotStep, (step) => {
  const snap = (v: number) => v === 0 ? 0 : Math.ceil(v / step) * step

  form.closeBufferMinutes = snap(form.closeBufferMinutes)
  form.deliveryLeadMinutes = Math.max(step, snap(form.deliveryLeadMinutes))
  form.pickupLeadMinutes = Math.max(step, snap(form.pickupLeadMinutes))
})

const handleSave = async () => {
  const tenantId = tenant.value.id

  if (!form.enabled && tenant.value.orderSchedulingConfig?.enabled) {
    const holdingStatusId = tenant.value.orderSchedulingConfig.holdingStatusId

    if (holdingStatusId) {
      const { total } = await api.orders.list(tenantId, null, { statusIds: [holdingStatusId], pageSize: 0 })

      if (total > 0) {
        error(`Нельзя выключить: есть запланированные заказы (${total}). Завершите или отмените их в разделе Заказы.`)

        return
      }
    }
  }

  saving.value = true
  try {
    if (form.enabled && !form.holdingStatusId) {
      const holdingId = await api.orders.ensureScheduledHoldingStatus(tenantId)

      form.holdingStatusId = holdingId
    }
    await tenantStore.update({ orderSchedulingConfig: { ...form } })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/layout' as *;

.settings-root {
  @include flex-col(var(--space-24));
  max-width: 680px;
}

.form {
  @include modal-form;
}

.row {
  display: grid;
  gap: var(--space-12);

  &.row-half {
    grid-template-columns: 1fr 1fr;
  }

  &.row-three {
    grid-template-columns: repeat(3, 1fr);
  }
}

.section-hint {
  margin-top: calc(-1 * var(--space-8));
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-loose);
}

.footer {
  padding-top: var(--space-4);
}
</style>
