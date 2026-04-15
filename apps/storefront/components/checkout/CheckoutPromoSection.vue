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
        Промокод принят
      </template>
      <template v-else>
        <X :size="14" class="promo-icon err" />
        {{ checkout.promoResult.error ?? 'Промокод недействителен' }}
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { useCheckoutStore } from '~/stores/checkout'
import { FsHeading, FsInput, FsButton } from '@fastio/public-ui'

const checkout = useCheckoutStore()
const loading = ref(false)

async function checkPromo() {
  loading.value = true
  try {
    await checkout.applyPromoCode()
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
