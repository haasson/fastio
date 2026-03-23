<template>
  <section class="form-section">
    <FsHeading as="h6" class="section-title">Промокод</FsHeading>
    <div class="promo-row">
      <FsInput v-model="checkout.form.promoCode" placeholder="PROMO2025" class="promo-input" />
      <FsButton variant="outline" :loading="loading" @click="checkPromo">
        Применить
      </FsButton>
    </div>
    <div v-if="checkout.promoResult" class="promo-result">
      <template v-if="checkout.promoResult.valid">
        <Check :size="14" class="promo-icon ok" />
        Скидка {{ promoLabel }}: −{{ checkout.discountAmount }} {{ currency }}
      </template>
      <template v-else>
        <X :size="14" class="promo-icon err" />
        Промокод недействителен
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { useCartStore } from '~/stores/cart'
import { useCheckoutStore } from '~/stores/checkout'
import { FsHeading, FsInput, FsButton } from '@fastio/public-ui'

type Props = {
  currency: string
}

const props = defineProps<Props>()

const checkout = useCheckoutStore()
const cart = useCartStore()

const loading = ref(false)

const promoLabel = computed(() => {
  const pr = checkout.promoResult
  if (!pr?.valid) return ''
  if (pr.discount_type === 'percent') return `${pr.discount_value}%`
  return `${pr.discount_value} ${props.currency}`
})

async function checkPromo() {
  if (!checkout.form.promoCode.trim()) return
  loading.value = true
  try {
    const result = await $fetch('/api/promo/check', {
      method: 'POST',
      body: { code: checkout.form.promoCode.trim(), subtotal: cart.subtotal },
    })
    checkout.promoResult = result as typeof checkout.promoResult
  } catch {
    checkout.promoResult = { valid: false }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.form-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  margin: 0 0 16px;
}

.promo-row {
  display: flex;
  gap: 8px;
}

.promo-input {
  flex: 1;
}

.promo-result {
  display: flex;
  align-items: center;
  gap: 6px;
  @include text-xs;
  margin-top: 8px;
}

.promo-icon {
  flex-shrink: 0;

  &.ok { color: color-mix(in srgb, var(--color-success) 80%, #000); }
  &.err { color: color-mix(in srgb, var(--color-error) 80%, #000); }
}
</style>
