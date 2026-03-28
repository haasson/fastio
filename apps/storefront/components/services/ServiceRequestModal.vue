<template>
  <FsDialog
    :model-value="modelValue"
    title="Оставить заявку"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="request-modal-root">
      <div class="service-info">
        <FsText variant="body-sm" class="service-name">{{ dish.name }}</FsText>
        <FsText variant="body-sm" class="service-price">{{ dish.price }} {{ currency }}</FsText>
      </div>

      <div class="fields">
        <FsField label="Имя">
          <FsInput v-model="form.name" placeholder="Иван" autocomplete="given-name" />
        </FsField>
        <FsField label="Телефон" required :error="phoneError">
          <FsInput
            v-model="form.phone"
            type="tel"
            placeholder="+7 (999) 123-45-67"
            autocomplete="tel"
            mask="+7 (###) ###-##-##"
            :error="!!phoneError"
            @input="phoneError = ''"
          />
        </FsField>
        <FsField label="Комментарий">
          <FsTextarea v-model="form.comment" placeholder="Уточните детали..." :rows="2" resize="none" />
        </FsField>
      </div>

      <FsText v-if="submitError" variant="caption" class="error-msg">{{ submitError }}</FsText>

      <FsButton variant="primary" class="submit-btn" :loading="loading" @click="submit">
        Отправить заявку
      </FsButton>
    </div>
  </FsDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useNuxtData, navigateTo } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { validationRules } from '@fastio/kit'
import { FsDialog, FsText, FsField, FsInput, FsTextarea, FsButton } from '@fastio/public-ui'
import { useAuthStore } from '~/stores/auth'
import { useSupabaseClient } from '~/composables/useSupabaseClient'
import { useCurrency } from '~/composables/useCurrency'

type Props = {
  modelValue: boolean
  dish: { id: string; name: string; price: number; categoryName: string | null }
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const authStore = useAuthStore()
const { data: tenant } = useNuxtData<Tenant>('tenant')
const currency = useCurrency()

const form = ref({ name: '', phone: '', comment: '' })
const phoneError = ref('')
const submitError = ref('')
const loading = ref(false)

watch(() => props.modelValue, (open) => {
  if (!open) return
  form.value.name = authStore.customerName ?? ''
  form.value.phone = authStore.customerPhone ?? ''
  form.value.comment = ''
  phoneError.value = ''
  submitError.value = ''
})

async function submit() {
  phoneError.value = ''
  submitError.value = ''

  const digits = form.value.phone.replace(/\D/g, '')
  if (!digits) { phoneError.value = validationRules.phone.required.message; return }
  if (digits.length < 11) { phoneError.value = validationRules.phone.format.message; return }

  loading.value = true
  try {
    const headers: Record<string, string> = {}
    if (authStore.isAuthenticated) {
      const supabase = useSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) headers.Authorization = `Bearer ${session.access_token}`
    }

    const result = await $fetch<{ id: string }>('/api/orders', {
      method: 'POST',
      headers,
      body: {
        customer: { name: form.value.name || undefined, phone: form.value.phone },
        items: [{ dishId: props.dish.id, dishName: props.dish.name, categoryName: props.dish.categoryName, price: props.dish.price, quantity: 1, removedIngredients: [], modifiers: [], addons: [] }],
        deliveryType: 'request',
        comment: form.value.comment || undefined,
        paymentType: 'cash',
        idempotencyKey: crypto.randomUUID(),
      },
    })

    emit('update:modelValue', false)
    await navigateTo(`/order/${result.id}`)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    submitError.value = fetchErr?.data?.message ?? 'Не удалось отправить заявку. Попробуйте ещё раз.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.request-modal-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.service-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--color-surface);
  border-radius: var(--radius-card);
}

.service-name {
  font-weight: 600;
}

.service-price {
  font-weight: 600;
  color: var(--primary);
  flex-shrink: 0;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-msg {
  color: var(--color-error);
}

.submit-btn {
  width: 100%;
}
</style>
