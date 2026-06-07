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

        <!-- auto + зоны -->
        <template v-else-if="deliveryMode === 'zones'">
          <template v-if="activeZones.length">
            <div class="zone-list">
              <div v-for="zone in activeZones" :key="zone.id" class="zone-item">
                <span class="zone-color" :style="{ background: zone.color }" />
                <span class="zone-name">{{ zone.name }}</span>
                <FsText variant="body-sm" color="secondary" class="zone-conditions">{{ formatZoneConditions(zone) }}</FsText>
              </div>
            </div>
          </template>
          <SfEmptyState
            v-else
            title="Информация о доставке"
            description="Зоны доставки пока не настроены"
          >
            <Truck :size="48" />
          </SfEmptyState>
        </template>

        <!-- auto + фикс -->
        <template v-else>
          <FsText variant="body-sm" class="auto-text">{{ autoText }}</FsText>
        </template>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Truck } from 'lucide-vue-next'
import { useNuxtData, useAsyncData, useRequestFetch, useRoute } from 'nuxt/app'
import type { DeliveryZone, Tenant } from '@fastio/shared'
import { defaultSiteLayout, defaultSiteContent, deepMerge } from '@fastio/shared'
import { FsSection, FsText, FsRichContent } from '@fastio/public-ui'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
import { buildDeliveryText, formatZoneConditions } from '~/features/delivery'

const rfetch = useRequestFetch()
const route = useRoute()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}

await useAsyncData('delivery-zones', () => rfetch<DeliveryZone[]>('/api/delivery-zones', slugQuery))

const { data: tenant } = useNuxtData<Tenant>('tenant')
const { data: zones } = useNuxtData<DeliveryZone[]>('delivery-zones')

type SiteLayoutType = ReturnType<typeof defaultSiteLayout>
type SiteContentType = ReturnType<typeof defaultSiteContent>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayoutType>),
)

const content = computed(() =>
  deepMerge(defaultSiteContent(), (tenant.value?.siteContent ?? {}) as Partial<SiteContentType>),
)

const descriptionMode = computed(() => layout.value.pageSettings.delivery?.descriptionMode ?? 'auto')
const deliveryMode = computed(() => tenant.value?.deliveryMode ?? 'fixed')
const manualText = computed(() => content.value.delivery?.manualText ?? '')
const activeZones = computed(() => (zones.value ?? []).filter((z) => z.isActive))
const autoText = computed(() => buildDeliveryText(zones.value ?? [], tenant.value!))
</script>

<style scoped lang="scss">
.auto-text {
  white-space: pre-line;
}

.zone-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zone-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.zone-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 3px;
}

.zone-name {
  font-weight: var(--font-weight-semibold);
  flex: 1;
}

.zone-conditions {
  flex-shrink: 0;
  text-align: right;
}
</style>
