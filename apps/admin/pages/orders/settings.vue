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
            v-if="modules.delivery.value.active"
            v-model:value="form.deliveryLeadMinutes"
            label="Буфер при открытии — доставка"
            :options="leadOptions"
          />
          <UiSelect
            v-if="modules.pickup.value.active"
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
import { useTenantStore } from '~/stores/tenant'
import { useModules } from '~/composables/plan/useModules'
import SettingToggle from '~/components/ui/SettingToggle.vue'

const SLOT_STEP_OPTIONS = [
  { label: '15 мин', value: 15 },
  { label: '30 мин', value: 30 },
  { label: '1 час', value: 60 },
]

const tenantStore = useTenantStore()
const modules = useModules()
const { success } = useMessage()
const saving = ref(false)

const tenant = computed(() => tenantStore.tenant)

const defaultConfig = (): OrderSchedulingConfig => ({
  enabled: false,
  slotStep: 30,
  daysAhead: 3,
  deliveryLeadMinutes: 60,
  pickupLeadMinutes: 30,
  closeBufferMinutes: 30,
})

const buildForm = (cfg?: OrderSchedulingConfig | null): OrderSchedulingConfig => ({
  ...defaultConfig(),
  ...cfg,
})

const form = reactive<OrderSchedulingConfig>(buildForm(tenant.value?.orderSchedulingConfig))

const leadOptions = computed(() => buildMinuteOptions(form.slotStep, 120))
const bufferOptions = computed(() => buildMinuteOptions(form.slotStep, 120, true))

watch(tenant, (t) => t && Object.assign(form, buildForm(t.orderSchedulingConfig)))

// При смене шага — округляем буферы вверх до ближайшего кратного
watch(() => form.slotStep, (step) => {
  const snap = (v: number) => v === 0 ? 0 : Math.ceil(v / step) * step

  form.closeBufferMinutes = snap(form.closeBufferMinutes)
  form.deliveryLeadMinutes = Math.max(step, snap(form.deliveryLeadMinutes))
  form.pickupLeadMinutes = Math.max(step, snap(form.pickupLeadMinutes))
})

const handleSave = async () => {
  saving.value = true
  try {
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
