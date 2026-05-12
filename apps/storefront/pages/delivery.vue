<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Доставка">
        <!-- manual: rich text от тенанта -->
        <template v-if="descriptionMode === 'manual'">
          <FsRichContent v-if="manualText" :html="manualText" />
          <SfEmptyState
            v-else
            title="Информация о доставке"
            description="Раздел скоро появится"
          >
            <Truck :size="48" />
          </SfEmptyState>
        </template>

        <!-- auto + карта -->
        <template v-else-if="showMap">
          <template v-if="zones?.length">
            <FsText variant="body-sm" color="secondary" class="map-description">{{ mapDescription }}</FsText>
            <ClientOnly>
              <DeliveryMapView :zones="zones" :dark="isDark" />
            </ClientOnly>
          </template>
          <SfEmptyState
            v-else
            title="Информация о доставке"
            description="Зоны доставки пока не настроены"
          >
            <Truck :size="48" />
          </SfEmptyState>
        </template>

        <!-- auto + текст -->
        <template v-else>
          <FsText variant="body-sm" class="auto-text">{{ autoText }}</FsText>
        </template>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { Truck } from 'lucide-vue-next'
import { useNuxtData, useAsyncData, useRequestFetch, useRoute } from 'nuxt/app'
import type { DeliveryZone, Tenant } from '@fastio/shared'
import { defaultSiteLayout, defaultSiteContent, deepMerge, isPresetDark } from '@fastio/shared'
import { FsSection, FsText, FsRichContent } from '@fastio/public-ui'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
import { useCurrency } from '~/shared/composables/useCurrency'
import { buildDeliveryText, formatZoneConditions } from '~/features/delivery'

const DeliveryMapView = defineAsyncComponent(() => import('~/features/delivery/components/DeliveryMapView.vue'))

const rfetch = useRequestFetch()
const route = useRoute()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}

await useAsyncData('delivery-zones', () => rfetch<DeliveryZone[]>('/api/delivery-zones', slugQuery))

const { data: tenant } = useNuxtData<Tenant>('tenant')
const { data: zones } = useNuxtData<DeliveryZone[]>('delivery-zones')
const currency = useCurrency()

type SiteLayoutType = ReturnType<typeof defaultSiteLayout>
type SiteContentType = ReturnType<typeof defaultSiteContent>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayoutType>),
)

const content = computed(() =>
  deepMerge(defaultSiteContent(), (tenant.value?.siteContent ?? {}) as Partial<SiteContentType>),
)

const descriptionMode = computed(() => layout.value.pageSettings.delivery?.descriptionMode ?? 'auto')
const showMap = computed(() => layout.value.pageSettings.delivery?.showMap ?? false)
const isDark = computed(() => isPresetDark(tenant.value?.theme?.preset ?? ''))
const manualText = computed(() => content.value.delivery?.manualText ?? '')

const autoText = computed(() =>
  buildDeliveryText(zones.value ?? [], tenant.value!, currency.value),
)

const mapDescription = computed(() => {
  const active = (zones.value ?? []).filter((z) => z.isActive)
  if (active.length === 0) return ''

  const prefix = 'Мы доставляем в пределах указанных на карте зон.'
  const allFree = active.every((z) => z.deliveryFee === 0)
  if (allFree) return `${prefix} Доставка бесплатная.`

  const sameFee = active.every((z) => z.deliveryFee === active[0].deliveryFee && z.freeDeliveryFrom === active[0].freeDeliveryFrom)
  if (!sameFee) return `${prefix} Стоимость доставки зависит от зоны.`

  return `${prefix} ${formatZoneConditions(active[0], currency.value)}.`
})
</script>

<style scoped lang="scss">
.auto-text {
  white-space: pre-line;
}

.map-description {
  margin-bottom: 16px;
}
</style>
