<template>
  <UiForm @submit="handleSave">
    <div class="form">
      <UiText size="tiny" span class="section-title">Настройки доставки</UiText>

      <div class="row">
        <div class="field">
          <UiInputNumber
            v-model="form.deliveryMinOrder"
            label="Минимальная сумма заказа, ₽"
            :min="0"
            placeholder="500"
          />
          <span class="hint">При сумме ниже — заказ не принимается</span>
        </div>
        <div class="field">
          <UiInputNumber
            v-model="form.deliveryFee"
            label="Стоимость доставки, ₽"
            :min="0"
            placeholder="150"
          />
          <span class="hint">0 — бесплатная доставка</span>
        </div>
      </div>

      <UiText size="tiny" span class="section-title">Условия доставки</UiText>

      <RichTextEditor
        v-model="form.deliveryDescription"
        label="Описание условий доставки"
      />

      <div class="footer">
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </div>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiForm, UiButton, UiInputNumber, UiText, useMessage } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import RichTextEditor from '~/components/ui/RichTextEditor.vue'

const props = defineProps<{ tenant: Tenant }>()

const tenantStore = useTenantStore()

const buildForm = (t: Tenant) => ({
  deliveryMinOrder: (t.deliveryMinOrder ?? null) as number | null,
  deliveryFee: (t.deliveryFee ?? null) as number | null,
  deliveryDescription: t.deliveryDescription ?? '',
})

const form = reactive(buildForm(props.tenant))

watch(() => props.tenant, (t) => Object.assign(form, buildForm(t)))

const saving = ref(false)
const { success } = useMessage()

const handleSave = async () => {
  saving.value = true
  try {
    await tenantStore.update({ deliveryMinOrder: form.deliveryMinOrder ?? 0, deliveryFee: form.deliveryFee ?? 0, deliveryDescription: form.deliveryDescription })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/form' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title {
  @include section-title;
}

.row {
  @include form-row(16px);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.footer {
  @include settings-footer;
}

</style>
