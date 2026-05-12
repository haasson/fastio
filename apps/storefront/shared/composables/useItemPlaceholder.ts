import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { Package, Briefcase, UtensilsCrossed } from 'lucide-vue-next'
import type { Tenant } from '@fastio/shared'
import { selectItemVariant } from '@fastio/shared'

// Должно соответствовать packages/ui/src/components/UiPhotoPlaceholder.vue:
// food → SVG с приборами (storefront рендерит UtensilsCrossed как ближайший lucide-аналог),
// catalog → Package, services → Briefcase.
const ICONS = {
  food: UtensilsCrossed,
  catalog: Package,
  services: Briefcase,
} as const

export const useItemPlaceholder = () => {
  const { data: tenant } = useNuxtData<Tenant>('tenant')

  const placeholderIcon = computed(() => ICONS[selectItemVariant(
    tenant.value?.businessType ?? null,
    tenant.value?.menuStyle ?? 'food',
  )])

  return { placeholderIcon }
}
