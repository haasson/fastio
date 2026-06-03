<template>
  <UiForm class="form" @submit.prevent="page.submit">
    <UiFormSection title="Отображение заказов">
      <UiSelect
        v-model:value="form.ordersTileSize"
        label="Размер карточек заказов"
        :options="TILE_SIZE_OPTIONS"
        help="Ширина карточек заказов в списке (вкладка «Заказы»)"
      />
    </UiFormSection>

    <UiFormSection title="Методы оплаты" :columns="1">
      <div class="checkboxes">
        <UiCheckbox v-model="form.cash">Наличные</UiCheckbox>
        <UiCheckbox v-model="form.card">Карта при получении</UiCheckbox>
        <!-- Онлайн-оплата временно недоступна: провайдер (YooKassa) не интегрирован.
             Чекбокс заблокирован — даже если включить, заказы с paymentType=online
             отклонятся на сервере. Снимать блокировку после доделанной интеграции. -->
        <UiCheckbox v-model="form.online" disabled>Онлайн <span class="online-soon">(скоро)</span></UiCheckbox>
      </div>
    </UiFormSection>

    <UiFormSection
      title="Предзаказ"
      help="Клиент сможет выбрать — «как можно скорее» или к конкретному времени. Если выключено, заказ всегда оформляется как можно скорее."
      :columns="1"
    >
      <template #header-right>
        <div data-tour="preorder-toggle">
          <UiSwitch v-model="form.scheduling.enabled" />
        </div>
      </template>

      <template v-if="form.scheduling.enabled">
        <UiSelect
          v-model:value="form.scheduling.nextStatusId"
          label="Статус после срабатывания"
          :options="statusOptions"
          clearable
          placeholder="Не выбран"
          help="В этот статус система автоматически переведёт заказ, когда настанет время начала готовки. Обычно это первый рабочий статус, например «Принят» или «На кухне». Система сама создаёт статус «Запланировано» (в группе «Новые»), куда оператор переводит входящие заказы ко времени; когда время наступит, заказ перейдёт в выбранный статус."
        />

        <div data-tour="preorder-slots" class="row">
          <UiInputNumber
            v-model:value="form.scheduling.daysAhead"
            label="Дней вперёд"
            :min="1"
            :max="30"
            :show-button="true"
          />
          <UiSelect
            v-model:value="form.scheduling.slotStep"
            label="Шаг слотов"
            :options="SLOT_STEP_OPTIONS"
          />
        </div>

        <div data-tour="preorder-buffers" class="row row-three">
          <UiSelect
            v-model:value="form.scheduling.closeBufferMinutes"
            label="Буфер при закрытии"
            :options="bufferOptions"
            help="За сколько минут до конца дня исчезает опция «как можно скорее» и обрезаются последние слоты. Например, заведение работает до 22:00, буфер 30 мин — с 21:30 опция «сейчас» недоступна и последний слот тоже 21:30."
          />
          <UiSelect
            v-if="gate.delivery.value.enabled"
            v-model:value="form.scheduling.deliveryLeadMinutes"
            label="Буфер при открытии — доставка"
            :options="leadOptions"
            help="Минимальный интервал от текущего момента до ближайшего доступного слота. Например, буфер 60 мин — клиент не увидит слоты раньше чем через час."
          />
          <UiSelect
            v-if="gate.pickup.value.enabled"
            v-model:value="form.scheduling.pickupLeadMinutes"
            label="Буфер при открытии — самовывоз"
            :options="leadOptions"
            help="Минимальный интервал от текущего момента до ближайшего доступного слота. Например, буфер 60 мин — клиент не увидит слоты раньше чем через час."
          />
        </div>
      </template>
    </UiFormSection>
  </UiForm>
</template>

<script setup lang="ts">
import { watch, computed } from 'vue'
import { UiForm, UiFormSection, UiInputNumber, UiSelect, UiCheckbox, UiSwitch, useMessage } from '@fastio/ui'
import type { OrderSchedulingConfig, PaymentMethod, TileSize } from '@fastio/shared'
import { buildMinuteOptions, TILE_SIZE_OPTIONS } from '@fastio/shared'
import { storeToRefs } from 'pinia'
import { useTenantStore } from '~/shared/stores/tenant'
import { useOrderStatusesStore } from '~/features/orders'
import { useGate } from '~/shared/plan/useGate'
import { useDatabase } from '~/shared/data/useDatabase'
import { useEditableForm, cancelSubmit } from '~/shared/ui/composables/useEditableForm'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'

const SLOT_STEP_OPTIONS = [
  { label: '15 мин', value: 15 },
  { label: '30 мин', value: 30 },
  { label: '1 час', value: 60 },
]

const tenantStore = useTenantStore()
const statusesStore = useOrderStatusesStore()
const { statuses } = storeToRefs(statusesStore)
const api = useDatabase()
const gate = useGate()
const { error } = useMessage()

const tenant = computed(() => tenantStore.tenant)

const statusOptions = computed(() => statuses.value
  .filter((s) => s.groupType === 'in_progress')
  .map((s) => ({ label: s.name, value: s.id })),
)

const defaultScheduling = (): OrderSchedulingConfig => ({
  enabled: false,
  slotStep: 30,
  daysAhead: 3,
  deliveryLeadMinutes: 60,
  pickupLeadMinutes: 30,
  closeBufferMinutes: 30,
  holdingStatusId: null,
  nextStatusId: null,
})

type Form = {
  cash: boolean
  card: boolean
  online: boolean
  scheduling: OrderSchedulingConfig
  ordersTileSize: TileSize
}

const page = useEditableForm({
  source: tenant,
  build: (t): Form => ({
    cash: t.paymentMethods.includes('cash'),
    card: t.paymentMethods.includes('card'),
    online: t.paymentMethods.includes('online'),
    scheduling: { ...defaultScheduling(), ...t.orderSchedulingConfig },
    ordersTileSize: t.ordersTileSize ?? 'm',
  }),
  // errorMessage='' — у нас собственная бизнес-валидация ниже с конкретными сообщениями;
  // дефолтный «Не удалось сохранить» тут только мешал бы.
  errorMessage: '',
  save: async (data) => {
    const tenantId = tenant.value.id
    const methods = (['cash', 'card', 'online'] as const).filter((m) => data[m])

    if (methods.length === 0) {
      error('Должен быть выбран хотя бы один метод оплаты')
      throw cancelSubmit()
    }

    const scheduling = { ...data.scheduling }

    if (!scheduling.enabled && tenant.value.orderSchedulingConfig?.enabled) {
      const holdingStatusId = tenant.value.orderSchedulingConfig.holdingStatusId

      if (holdingStatusId) {
        const { total } = await api.orders.list(tenantId, null, { statusIds: [holdingStatusId], pageSize: 0 })

        if (total > 0) {
          error(`Нельзя выключить: есть запланированные заказы (${total}). Завершите или отмените их в разделе Заказы.`)
          throw cancelSubmit()
        }

        await api.orderStatuses.remove(holdingStatusId)
        await statusesStore.reload()
        scheduling.holdingStatusId = null
      }
    }

    if (scheduling.enabled && !scheduling.holdingStatusId) {
      scheduling.holdingStatusId = await api.orders.ensureScheduledHoldingStatus(tenantId)
      await statusesStore.reload()
    }

    await tenantStore.update({
      paymentMethods: methods as PaymentMethod[],
      orderSchedulingConfig: scheduling,
      ordersTileSize: data.ordersTileSize,
    })
  },
})

const { form } = page

const leadOptions = computed(() => buildMinuteOptions(form.scheduling.slotStep, 120))
const bufferOptions = computed(() => buildMinuteOptions(form.scheduling.slotStep, 120, true))

// При смене шага — округляем буферы вверх до ближайшего кратного
watch(() => form.scheduling.slotStep, (step) => {
  const snap = (v: number) => v === 0 ? 0 : Math.ceil(v / step) * step

  form.scheduling.closeBufferMinutes = snap(form.scheduling.closeBufferMinutes)
  form.scheduling.deliveryLeadMinutes = Math.max(step, snap(form.scheduling.deliveryLeadMinutes))
  form.scheduling.pickupLeadMinutes = Math.max(step, snap(form.scheduling.pickupLeadMinutes))
})

useRegisterPageForm(page)
useUnsavedGuard(page.isDirty)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.form {
  @include flex-col(var(--space-12));
  max-width: 720px;
}

.checkboxes {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.online-soon {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  align-items: start;

  &.row-three {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
