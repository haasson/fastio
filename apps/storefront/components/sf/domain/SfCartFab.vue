<template>
  <SfFab
    :visible="cart.count > 0"
    :count="cart.count"
    label="Корзина"
    :price="`${cart.subtotal} ${currency}`"
    class="cart-fab"
    @click="emit('click')"
  >
    <template #icon>
      <ShoppingCart :size="24" />
    </template>
    <template v-if="branchAddress" #caption>{{ branchAddress }}</template>
  </SfFab>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { ShoppingCart } from 'lucide-vue-next'
import type { BranchPublic, Tenant } from '@fastio/shared'
import { formatBranchAddressShort } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import { useSelectedBranchStore } from '~/stores/selectedBranch'
import { useCurrency } from '~/composables/useCurrency'
import SfFab from '~/components/sf/domain/SfFab.vue'

const emit = defineEmits<{ click: [] }>()
const cart = useCartStore()
const currency = useCurrency()
const branchStore = useSelectedBranchStore()
const { data: branchesData } = useNuxtData<BranchPublic[]>('branches')
const { data: tenant } = useNuxtData<Tenant>('tenant')

const branchAddress = computed(() => {
  if (tenant.value?.branchSelectionMode !== 'per_branch') return ''
  const branch = branchesData.value?.find((b) => b.id === branchStore.id)
  return branch ? formatBranchAddressShort(branch) : ''
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Адрес дублируется в pill в шапке на десктопе — здесь скрываем чтобы
// не было двух одинаковых надписей.
.cart-fab {
  @include lg {
    :deep(.fab-caption) {
      display: none;
    }
  }
}
</style>
