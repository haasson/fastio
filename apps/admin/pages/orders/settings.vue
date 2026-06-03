<template>
  <UiForm class="form" @submit.prevent="page.submit">
    <UiSectionHeader title="Отображение заказов" />
    <div class="row row-half">
      <UiSelect
        v-model:value="form.ordersTileSize"
        label="Размер карточек заказов"
        :options="TILE_SIZE_OPTIONS"
        message="Ширина карточек заказов в списке (вкладка «Заказы»)"
      />
    </div>

    <UiSectionHeader title="Методы оплаты" />
    <div class="checkboxes">
      <UiCheckbox v-model="form.cash">Наличные</UiCheckbox>
      <UiCheckbox v-model="form.card">Карта при получении</UiCheckbox>
      <!-- Онлайн-оплата временно недоступна: провайдер (YooKassa) не интегрирован.
           Чекбокс заблокирован — даже если включить, заказы с paymentType=online
           отклонятся на сервере. Снимать блокировку после доделанной интеграции. -->
      <UiCheckbox v-model="form.online" disabled>Онлайн <span class="online-soon">(скоро)</span></UiCheckbox>
    </div>

    <UiSectionHeader title="Предзаказ" />

    <div data-tour="preorder-toggle">
      <SettingToggle
        v-model="form.scheduling.enabled"
        label="Разрешить заказ ко времени"
        hint="Клиент сможет выбрать — «как можно скорее» или к конкретному времени. Если выключено, заказ всегда оформляется как можно скорее."
      />
    </div>

    <template v-if="form.scheduling.enabled">
      <UiSectionHeader title="Статусы" />
      <div class="row row-half">
        <UiSelect
          v-model:value="form.scheduling.nextStatusId"
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

      <UiSectionHeader title="Буферы" />
      <div data-tour="preorder-buffers" class="row row-three">
        <UiSelect
          v-model:value="form.scheduling.closeBufferMinutes"
          label="Буфер при закрытии"
          :options="bufferOptions"
        />
        <UiSelect
          v-if="gate.delivery.value.enabled"
          v-model:value="form.scheduling.deliveryLeadMinutes"
          label="Буфер при открытии — доставка"
          :options="leadOptions"
        />
        <UiSelect
          v-if="gate.pickup.value.enabled"
          v-model:value="form.scheduling.pickupLeadMinutes"
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
  </UiForm>
</template>

<script setup lang="ts">
import { watch, computed } from 'vue'
import { UiForm, UiInputNumber, UiSectionHeader, UiSelect, UiCheckbox, useMessage } from '@fastio/ui'
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
import SettingToggle from '~/shared/ui/components/SettingToggle.vue'

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
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/layout' as *;

.form {
  @include modal-form;
  max-width: 680px;
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
</style>
